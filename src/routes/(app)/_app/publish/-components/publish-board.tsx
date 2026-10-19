import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowSquareOut } from "@phosphor-icons/react/ArrowSquareOut";
import { CalendarPlus } from "@phosphor-icons/react/CalendarPlus";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Check } from "@phosphor-icons/react/Check";
import { Checks } from "@phosphor-icons/react/Checks";
import { Plus } from "@phosphor-icons/react/Plus";
import { X } from "@phosphor-icons/react/X";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { Spinner } from "#/components/ui/spinner";
import { cn } from "#/components/ui/utils";
import { Notice, PageTitleLevel } from "#/components/layouts/workspace-page";
import {
  addDays,
  dayKey,
  dayOfMonth,
  monthDays,
  monthTitle,
  shiftMonth,
  weekdayName,
} from "../-lib/calendar";
import { postFormat, postTitle, statusOf, timeIn, type Account, type Post } from "../-lib/posts";
import { PublishFilters, useChannelSelection } from "./publish-filters";
import { usePostActions } from "./use-post-actions";

type Shown = "all" | "queue" | "sent" | "failed";
const SHOWN: { value: Shown; label: string }[] = [
  { value: "all", label: "All posts" },
  { value: "queue", label: "Scheduled" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];
const QUEUED = new Set(["scheduled", "publishing", "uploaded", "paused"]);
const shows = (shown: Shown, post: Post) =>
  post.status !== "cancelled" &&
  (shown === "all" ||
    (shown === "queue" && QUEUED.has(post.status)) ||
    (shown === "sent" && post.status === "published") ||
    (shown === "failed" && post.status === "failed"));

/** What Select can act on: posts that have not started going out. */
const cancellable = (post: Post) => post.status === "scheduled" || post.status === "paused";

/** A post's look by status: failed stands out, sent steps back, paused is dashed. */
const tone = (post: Post) =>
  post.status === "failed"
    ? "border-destructive/40 bg-destructive/10"
    : post.status === "published"
      ? "border-border bg-muted/50 text-muted-foreground"
      : post.status === "paused"
        ? "border-dashed border-border bg-card"
        : "border-border bg-card";

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** A day column's width, and the space between columns and at the board's ends (px). */
const COLUMN = 280;
const GAP = 12;

/**
 * The Publish board: a month as a strip of dates and a row of day columns, scrolled
 * sideways. Also rendered with sample data on the landing page.
 */
export function PublishBoard({
  accounts,
  posts,
  date,
  timeZone,
  onZone,
  onNavigate,
  loading = false,
  failed = false,
}: {
  accounts: Account[];
  posts: Post[];
  /** The day the board opens on; today when absent. Its month is the one shown. */
  date: string | undefined;
  timeZone: string;
  onZone: (zone: string) => void;
  /** A day to open on, or undefined for today. */
  onNavigate: (date: string | undefined) => void;
  loading?: boolean;
  failed?: boolean;
}) {
  const phone = useMedia("(max-width: 639px)");
  const wide = useMedia("(min-width: 768px)");
  const Title = useContext(PageTitleLevel);
  const { selected, setSelected } = useChannelSelection(accounts);
  const [shown, setShown] = useState<Shown>("all");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { cancelMany } = usePostActions();

  const today = dayKey(new Date(), timeZone);
  const anchor = date ?? today;
  const days = useMemo(() => monthDays(anchor), [anchor]);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  // Posts by day, each day in time order.
  const byDay = useMemo(() => {
    const chosen = new Set(selected);
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (!chosen.has(post.accountId) || !shows(shown, post)) continue;
      const day = dayKey(new Date(post.scheduledAt), timeZone);
      const list = map.get(day);
      if (list) list.push(post);
      else map.set(day, [post]);
    }
    for (const list of map.values())
      list.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    return map;
  }, [posts, selected, shown, timeZone]);

  // The days in view, reported by the columns as they scroll: only a change re-renders the
  // toolbar and the strip, not every frame of a scroll.
  const [inView, setInView] = useState<[string, string]>([anchor, anchor]);
  const onRange = useCallback(
    (first: string, last: string) =>
      setInView((current) =>
        current[0] === first && current[1] === last ? current : [first, last],
      ),
    [],
  );
  const board = useRef<BoardHandle>(null);
  const strip = useRef<HTMLElement>(null);
  // The strip keeps the days in view on screen (a phone shows a week of it at a time).
  const firstInView = inView[0];
  useEffect(() => {
    const row = strip.current;
    const item = row?.querySelector<HTMLElement>(`[data-strip="${firstInView}"]`);
    if (
      row &&
      item &&
      (item.offsetLeft < row.scrollLeft ||
        item.offsetLeft + item.offsetWidth > row.scrollLeft + row.clientWidth)
    )
      row.scrollLeft = item.offsetLeft - row.clientWidth / 3;
  }, [firstInView]);

  const pickedPosts = posts.filter((post) => picked.has(post.id));
  const togglePick = useCallback(
    (post: Post) =>
      setPicked((current) => {
        const next = new Set(current);
        if (next.has(post.id)) next.delete(post.id);
        else next.add(post.id);
        return next;
      }),
    [],
  );
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  return (
    // The full width, not a page's column: the more days side by side, the better. And the
    // height under the workspace header (3.75rem): the board scrolls inside it, both ways.
    <div className="relative flex h-[calc(100dvh-3.75rem)] w-full min-w-0 flex-col gap-5 px-4 pt-4 md:px-7 md:pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <Title className="m-0 mr-1 text-xl font-semibold tracking-tight text-foreground">
          <span className="sr-only">Publish: </span>
          {monthTitle(anchor)}
        </Title>
        <Button size="sm" variant="outline" onClick={() => onNavigate(undefined)}>
          Today
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous month"
          onClick={() => onNavigate(shiftMonth(anchor, -1))}
        >
          <CaretLeft />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next month"
          onClick={() => onNavigate(shiftMonth(anchor, 1))}
        >
          <CaretRight />
        </Button>
        {loading && <Spinner />}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={selecting ? "secondary" : "outline"}
            aria-pressed={selecting}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            <Checks /> Select
          </Button>
          <PublishFilters
            phone={phone}
            accounts={accounts}
            selected={selected}
            onSelect={setSelected}
            shown={shown}
            shownOptions={SHOWN}
            onShown={setShown}
            timeZone={timeZone}
            onZone={onZone}
          />
          <Button size="sm" render={<Link to="/media" />}>
            <Plus /> {phone ? "New" : "New schedule"}
          </Button>
        </div>
      </div>

      {accounts.length === 0 && (
        <Notice>
          No channel yet —{" "}
          <Link to="/channels" className="underline underline-offset-4">
            connect one
          </Link>
          , then give your agent an{" "}
          <Link to="/api-keys" className="underline underline-offset-4">
            API key
          </Link>
          .
        </Notice>
      )}
      {failed && <Notice tone="danger">Could not load this month. Try again in a moment.</Notice>}

      {/* The month at a glance: a dot where there are posts; the days in view marked. */}
      <nav
        ref={strip}
        aria-label="Days"
        className="scrollbar-none relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {days.map((day) => {
          const count = byDay.get(day)?.length ?? 0;
          const shownNow = day >= inView[0] && day <= inView[1];
          return (
            <button
              key={day}
              data-strip={day}
              type="button"
              onClick={() => board.current?.scrollTo(day)}
              aria-label={`${weekdayName(day, "long")} ${dayOfMonth(day)}, ${count} ${count === 1 ? "post" : "posts"}`}
              aria-current={day === today ? "date" : undefined}
              className={cn(
                "flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-lg py-1.5 text-foreground transition-colors hover:bg-muted",
                shownNow && "bg-muted",
                day === today && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium uppercase",
                  day === today ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {weekdayName(day, "short").slice(0, 2)}
              </span>
              <span className="text-sm font-semibold tabular-nums">{dayOfMonth(day)}</span>
              <span
                aria-hidden
                className={cn("size-1 rounded-full bg-current", count ? "opacity-70" : "opacity-0")}
              />
            </button>
          );
        })}
      </nav>

      <DayColumns
        ref={board}
        days={days}
        anchor={anchor}
        today={today}
        byDay={byDay}
        accountById={accountById}
        timeZone={timeZone}
        selecting={selecting}
        picked={picked}
        onPick={togglePick}
        phone={phone}
        wide={wide}
        onRange={onRange}
      />

      {selecting && (
        <div className="absolute bottom-6 left-1/2 z-20 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-4 text-sm text-popover-foreground shadow-lg">
          <span className="tabular-nums">
            {picked.size ? `${picked.size} selected` : "Pick scheduled posts"}
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={!picked.size}
            onClick={() => cancelMany(pickedPosts, stopSelecting)}
          >
            Cancel posts
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Done selecting"
            onClick={stopSelecting}
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}

type BoardHandle = { scrollTo: (day: string) => void };
const NO_POSTS: Post[] = [];

/**
 * The day columns, scrolled sideways. Only the columns in view (and one either side) are
 * rendered: a busy month is hundreds of cards. Columns are a fixed width, so nothing needs
 * measuring, and a scroll re-renders this alone.
 */
function DayColumns({
  ref,
  days,
  anchor,
  today,
  byDay,
  accountById,
  timeZone,
  selecting,
  picked,
  onPick,
  phone,
  wide,
  onRange,
}: {
  ref: Ref<BoardHandle>;
  days: string[];
  anchor: string;
  today: string;
  byDay: Map<string, Post[]>;
  accountById: Map<string, Account>;
  timeZone: string;
  selecting: boolean;
  picked: Set<string>;
  onPick: (post: Post) => void;
  phone: boolean;
  wide: boolean;
  onRange: (first: string, last: string) => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const width = phone ? Math.min(Math.round(window.innerWidth * 0.78), COLUMN) : COLUMN;
  const edge = wide ? 28 : 16;
  const anchorIndex = Math.max(days.indexOf(anchor), 0);
  const virtualizer = useVirtualizer({
    horizontal: true,
    count: days.length,
    getScrollElement: () => board.current,
    estimateSize: () => width,
    gap: GAP,
    paddingStart: edge,
    paddingEnd: edge,
    overscan: 1,
    // A scroll need not render synchronously; the browser keeps scrolling meanwhile.
    useFlushSync: false,
    // The server and the first client render show the days around the one asked for.
    initialRect: { width: 1100, height: 600 },
    initialOffset: () => Math.max(edge + anchorIndex * (width + GAP) - (1100 - width) / 2, 0),
  });
  useEffect(() => virtualizer.measure(), [virtualizer, width, edge]);

  const range = virtualizer.range;
  const first = range ? days[range.startIndex] : undefined;
  const last = range ? days[range.endIndex] : undefined;
  useEffect(() => {
    if (first && last) onRange(first, last);
  }, [first, last, onRange]);

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: (day) =>
        virtualizer.scrollToIndex(days.indexOf(day), { align: "center", behavior: "smooth" }),
    }),
    [virtualizer, days],
  );
  // Open on the day asked for (today, or the 1st of another month), centred.
  useLayoutEffect(() => {
    virtualizer.scrollToIndex(days.indexOf(anchor), { align: "center" });
  }, [anchor]);

  const columns = virtualizer.getVirtualItems();
  return (
    <div
      ref={board}
      className="scrollbar-none -mx-4 min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain md:-mx-7"
    >
      {/* The board only moves sideways; each day scrolls its own posts up and down, so a
          swipe on a phone moves one or the other instead of the whole board drifting both
          ways. The month's full width keeps the scroll true; the rendered columns sit at
          their place in it. No scroll snapping: it would only know the rendered columns and
          pull the board back to them. */}
      <div className="h-full" style={{ width: virtualizer.getTotalSize() }}>
        <div
          className="flex h-full items-stretch"
          style={{ gap: GAP, paddingLeft: columns[0]?.start ?? 0 }}
        >
          {columns.map(({ index }) => (
            <DayColumn
              key={days[index]}
              day={days[index]}
              posts={byDay.get(days[index]) ?? NO_POSTS}
              today={today}
              width={width}
              accountById={accountById}
              timeZone={timeZone}
              selecting={selecting}
              picked={picked}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One day: its date, how many posts, a + to schedule, and the posts in time order. */
const DayColumn = memo(function DayColumn({
  day,
  posts,
  today,
  width,
  accountById,
  timeZone,
  selecting,
  picked,
  onPick,
}: {
  day: string;
  posts: Post[];
  today: string;
  width: number;
  accountById: Map<string, Account>;
  timeZone: string;
  selecting: boolean;
  picked: Set<string>;
  onPick: (post: Post) => void;
}) {
  const past = day < today;
  return (
    <section
      data-day={day}
      aria-label={`${weekdayName(day, "long")} ${dayOfMonth(day)}`}
      style={{ width }}
      className="flex h-full min-h-0 shrink-0 flex-col gap-2.5"
    >
      <header className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl border text-base font-semibold tabular-nums",
            day === today
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground",
          )}
        >
          {dayOfMonth(day)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="m-0 truncate text-sm font-semibold text-foreground">
            {day === today
              ? "Today"
              : day === addDays(today, 1)
                ? "Tomorrow"
                : weekdayName(day, "long")}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </p>
        </div>
        {!past && (
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={`Schedule on ${weekdayName(day, "long")} ${dayOfMonth(day)}`}
            render={<Link to="/media" />}
          >
            <Plus />
          </Button>
        )}
      </header>

      {/* The day's own scroll; it stops at its ends rather than pulling the board along. */}
      <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain pb-6">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            account={accountById.get(post.accountId)}
            timeZone={timeZone}
            selecting={selecting}
            picked={picked.has(post.id)}
            onPick={() => onPick(post)}
          />
        ))}

        {posts.length === 0 &&
          (past ? (
            <p className="m-0 rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              No posts
            </p>
          ) : (
            <Link
              to="/media"
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-3 py-8 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground"
            >
              <CalendarPlus size={18} />
              Schedule a post
            </Link>
          ))}
      </div>
    </section>
  );
});

function PostCard({
  post,
  account,
  timeZone,
  selecting,
  picked,
  onPick,
}: {
  post: Post;
  account: Account | undefined;
  timeZone: string;
  selecting: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const status = statusOf(post);
  const face = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium tabular-nums text-foreground">
        <PlatformLogo provider={post.provider} size="xs" />
        {timeIn(post.scheduledAt, timeZone)}
        <span className="ml-auto">
          {selecting && cancellable(post) ? (
            <span
              aria-hidden
              className={cn(
                "grid size-4 place-items-center rounded border",
                picked ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {picked && <Check size={11} weight="bold" />}
            </span>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </span>
      </span>
      <span className="line-clamp-2 text-sm leading-snug font-medium break-words text-foreground">
        {postTitle(post)}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {account?.name ?? "Channel unavailable"}
        {postFormat(post) ? ` · ${postFormat(post)}` : ""}
      </span>
    </>
  );
  const look = cn(
    "flex w-full min-w-0 flex-col gap-1.5 rounded-xl border p-3 text-left transition-[filter,opacity] hover:brightness-95",
    tone(post),
  );

  if (selecting)
    return cancellable(post) ? (
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        onClick={onPick}
        className={cn(look, picked && "ring-2 ring-primary")}
      >
        {face}
      </button>
    ) : (
      <div className={cn(look, "opacity-50")}>{face}</div>
    );

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={look}>
            {face}
          </button>
        }
      />
      <PopoverContent align="start" className="w-72">
        <PostDetails post={post} account={account} timeZone={timeZone} />
      </PopoverContent>
    </Popover>
  );
}

/** A post's details and what can be done with it; mounted only while its card is open. */
function PostDetails({
  post,
  account,
  timeZone,
}: {
  post: Post;
  account: Account | undefined;
  timeZone: string;
}) {
  const { cancel, retry, retrying } = usePostActions();
  const status = statusOf(post);
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(
    new Date(
      post.status === "published" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt,
    ),
  );
  return (
    <>
      <div className="flex items-center gap-2">
        {account && (
          <ChannelAvatar
            provider={account.provider}
            avatar={account.avatar}
            name={account.name}
            size="sm"
          />
        )}
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {account?.name ?? "Channel unavailable"}
          {postFormat(post) ? ` · ${postFormat(post)}` : ""}
        </p>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <p className="text-sm font-medium break-words text-foreground">{postTitle(post)}</p>
      <p className="text-xs text-muted-foreground tabular-nums">{when}</p>
      {post.error && (
        <p
          className={cn(
            "text-xs break-words",
            post.status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {post.status === "scheduled" ? `Trying again: ${post.error}` : post.error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {post.platformUrl && post.status !== "cancelled" && (
          <Button
            size="sm"
            variant="outline"
            render={<a href={post.platformUrl} target="_blank" rel="noreferrer" />}
          >
            <ArrowSquareOut /> Open
          </Button>
        )}
        {(post.status === "failed" || post.status === "paused") && (
          <Button
            size="sm"
            variant="outline"
            disabled={retrying === post.id}
            onClick={() => retry(post)}
          >
            {retrying === post.id ? <Spinner /> : <ArrowCounterClockwise />} Retry
          </Button>
        )}
        {cancellable(post) && (
          <Button size="sm" variant="ghost" onClick={() => cancel(post)}>
            <X /> Cancel
          </Button>
        )}
      </div>
    </>
  );
}
