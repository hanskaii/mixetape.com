import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
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

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

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
  const phone = usePhone();
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
      map.set(day, [...(map.get(day) ?? []), post]);
    }
    for (const list of map.values())
      list.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    return map;
  }, [posts, selected, shown, timeZone]);

  // Which columns are in view, for the strip: measured as the board scrolls.
  const board = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLElement>(null);
  const [inView, setInView] = useState<[string, string]>([anchor, anchor]);
  const measure = () => {
    const box = board.current;
    if (!box) return;
    const columns = [...box.querySelectorAll<HTMLElement>("[data-day]")];
    const left = box.scrollLeft;
    const right = left + box.clientWidth;
    const seen = columns.filter(
      (column) =>
        column.offsetLeft + column.offsetWidth * 0.5 > left &&
        column.offsetLeft + column.offsetWidth * 0.5 < right,
    );
    if (!seen.length) return;
    const first = seen[0].dataset.day!;
    setInView([first, seen.at(-1)!.dataset.day!]);
    // The strip keeps the days in view on screen (a phone shows a week of it at a time).
    const row = strip.current;
    const item = row?.querySelector<HTMLElement>(`[data-strip="${first}"]`);
    if (
      row &&
      item &&
      (item.offsetLeft < row.scrollLeft ||
        item.offsetLeft + item.offsetWidth > row.scrollLeft + row.clientWidth)
    )
      row.scrollLeft = item.offsetLeft - row.clientWidth / 3;
  };
  const scrollTo = (day: string, behavior: ScrollBehavior) => {
    const box = board.current;
    const column = box?.querySelector<HTMLElement>(`[data-day="${day}"]`);
    if (!box || !column) return;
    box.scrollTo({
      left: column.offsetLeft - (box.clientWidth - column.offsetWidth) / 2,
      behavior,
    });
  };
  // Open on the day asked for (today, or the 1st of another month), centred.
  useLayoutEffect(() => {
    scrollTo(anchor, "instant");
    measure();
  }, [anchor]);

  const pickedPosts = posts.filter((post) => picked.has(post.id));
  const togglePick = (post: Post) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(post.id)) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  return (
    // The full width, not a page's column: the more days side by side, the better.
    <div className="flex w-full min-w-0 flex-col gap-5 px-4 py-4 md:px-7 md:py-6">
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
        className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {days.map((day) => {
          const count = byDay.get(day)?.length ?? 0;
          const shownNow = day >= inView[0] && day <= inView[1];
          return (
            <button
              key={day}
              data-strip={day}
              type="button"
              onClick={() => scrollTo(day, "smooth")}
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

      <div
        ref={board}
        onScroll={measure}
        className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:-mx-7 md:px-7"
      >
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const past = day < today;
          return (
            <section
              key={day}
              data-day={day}
              aria-label={`${weekdayName(day, "long")} ${dayOfMonth(day)}`}
              className="flex w-[78vw] max-w-[17.5rem] shrink-0 snap-center flex-col gap-2.5 sm:w-[17.5rem]"
            >
              <header className="flex items-center gap-2.5">
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
                    {list.length} {list.length === 1 ? "post" : "posts"}
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

              {list.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  account={accountById.get(post.accountId)}
                  timeZone={timeZone}
                  selecting={selecting}
                  picked={picked.has(post.id)}
                  onPick={() => togglePick(post)}
                />
              ))}

              {list.length === 0 &&
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
            </section>
          );
        })}
      </div>

      {selecting && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-4 text-sm text-popover-foreground shadow-lg">
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
