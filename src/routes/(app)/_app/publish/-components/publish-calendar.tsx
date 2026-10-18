import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowSquareOut } from "@phosphor-icons/react/ArrowSquareOut";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { CaretUp } from "@phosphor-icons/react/CaretUp";
import { Stack } from "@phosphor-icons/react/Stack";
import { X } from "@phosphor-icons/react/X";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { Spinner } from "#/components/ui/spinner";
import { cn } from "#/components/ui/utils";
import { Notice, Page, PageHeader } from "#/components/layouts/workspace-page";
import { calendarPostsQuery } from "../-fn/calendar.fn";
import {
  calendarTitle,
  dayKey,
  dayOfMonth,
  hourOf,
  shiftAnchor,
  visibleDays,
  weekdayName,
  type CalendarMode,
} from "../-lib/calendar";
import { postFormat, postTitle, statusOf, timeIn, type Account, type Post } from "../-lib/posts";
import {
  ChannelFilter,
  FILTER_BUTTON,
  FilterSheet,
  useChannelSelection,
  useViewerZone,
  ZoneFilter,
} from "./publish-filters";
import { FeedbackButton } from "#/components/modals/feedback-button";
import { usePostActions } from "./use-post-actions";
import { DateSheet } from "./date-sheet";

const MODES: { value: CalendarMode; label: string }[] = [
  { value: "days", label: "3 days" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

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

/** Posts a month cell lists before folding the rest under "N more". */
const MONTH_CELL_POSTS = 3;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const hourLabel = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;

/** A post's look by status: failed stands out, sent steps back, paused is dashed. */
const tone = (post: Post) =>
  post.status === "failed"
    ? "border-destructive/40 bg-destructive/15 text-foreground"
    : post.status === "published"
      ? "border-border bg-muted/60 text-muted-foreground"
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

/** The Publish calendar: a month, a week, or three days. */
export function PublishCalendar({
  accounts,
  view,
  date,
  onNavigate,
  viewToggle,
}: {
  accounts: Account[];
  view: CalendarMode;
  /** The day the view is around; today when absent. */
  date: string | undefined;
  onNavigate: (next: { mode?: CalendarMode; date?: string }) => void;
  viewToggle: ReactNode;
}) {
  const phone = usePhone();
  const [timeZone, setTimeZone] = useViewerZone();
  const { selected, setSelected } = useChannelSelection(accounts);
  const [shown, setShown] = useState<Shown>("all");
  const mode = view;
  const today = dayKey(new Date(), timeZone);
  const anchor = date ?? today;
  const days = useMemo(() => visibleDays(mode, anchor), [mode, anchor]);
  const {
    data: posts = [],
    isFetching,
    isError,
  } = useQuery({
    ...calendarPostsQuery(days),
    placeholderData: keepPreviousData,
  });

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

  const filters = (
    <>
      <ChannelFilter accounts={accounts} selected={selected} onChange={setSelected} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" className={FILTER_BUTTON}>
              <Stack size={17} /> {SHOWN.find((item) => item.value === shown)?.label}{" "}
              <CaretDown size={13} />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuRadioGroup value={shown} onValueChange={(value) => setShown(value as Shown)}>
            {SHOWN.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ZoneFilter timeZone={timeZone} onChange={setTimeZone} />
    </>
  );

  return (
    <Page>
      <PageHeader
        title="Publish"
        actions={
          <>
            <FeedbackButton />
            {viewToggle}
          </>
        }
      />

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

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {phone ? (
          // A phone moves by picking a date; the arrows and Today live in the sheet.
          <DateSheet anchor={anchor} today={today} onPick={(next) => onNavigate({ date: next })} />
        ) : (
          <>
            <div className="flex items-center">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Previous"
                onClick={() => onNavigate({ date: shiftAnchor(mode, anchor, -1) })}
              >
                <CaretLeft />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Next"
                onClick={() => onNavigate({ date: shiftAnchor(mode, anchor, 1) })}
              >
                <CaretRight />
              </Button>
            </div>
            <h2 className="min-w-0 text-lg font-semibold tracking-tight text-foreground">
              {calendarTitle(mode, anchor)}
            </h2>
            <Button size="sm" variant="outline" onClick={() => onNavigate({ date: undefined })}>
              Today
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className={FILTER_BUTTON}>
                {MODES.find((item) => item.value === mode)?.label} <CaretDown size={13} />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-32">
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(value) => onNavigate({ mode: value as CalendarMode })}
            >
              {MODES.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {isFetching && <Spinner />}
        <div className="ml-auto flex items-center gap-1">
          {phone ? (
            <FilterSheet
              accounts={accounts}
              selected={selected}
              onSelect={setSelected}
              shown={shown}
              shownOptions={SHOWN}
              onShown={setShown}
              timeZone={timeZone}
              onZone={setTimeZone}
            />
          ) : (
            filters
          )}
        </div>
      </div>

      {isError && <Notice tone="danger">Could not load these days. Try again in a moment.</Notice>}

      {mode === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          today={today}
          byDay={byDay}
          accountById={accountById}
          timeZone={timeZone}
          compact={phone}
        />
      ) : (
        <TimeGrid
          days={days}
          today={today}
          byDay={byDay}
          accountById={accountById}
          timeZone={timeZone}
          compact={phone}
        />
      )}
    </Page>
  );
}

type GridProps = {
  days: string[];
  today: string;
  byDay: Map<string, Post[]>;
  accountById: Map<string, Account>;
  timeZone: string;
  compact: boolean;
};

const FRAME = "overflow-hidden rounded-2xl border border-border bg-card";

function MonthGrid({
  days,
  anchor,
  today,
  byDay,
  accountById,
  timeZone,
  compact,
}: GridProps & { anchor: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const month = anchor.slice(0, 7);
  const toggle = (day: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  return (
    <div className={FRAME}>
      <div className="grid grid-cols-7 border-b border-border">
        {days.slice(0, 7).map((day) => (
          <div
            key={day}
            className="border-r border-border py-2 text-center text-xs font-medium text-muted-foreground last:border-r-0 sm:text-sm"
          >
            {weekdayName(day, compact ? "short" : "long")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const expanded = open.has(day);
          const visible = expanded ? list : list.slice(0, MONTH_CELL_POSTS);
          return (
            <div
              key={day}
              className={cn(
                "flex min-h-24 min-w-0 flex-col gap-1 border-r border-b border-border p-1 sm:min-h-32 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                day < today && "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mb-0.5 ml-1 inline-flex size-6 items-center justify-center rounded-full text-xs sm:text-sm",
                  day === today
                    ? "bg-primary font-semibold text-primary-foreground"
                    : day.slice(0, 7) === month
                      ? "text-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {dayOfMonth(day)}
              </span>
              {visible.map((post) => (
                <PostPopover
                  key={post.id}
                  post={post}
                  account={accountById.get(post.accountId)}
                  timeZone={timeZone}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 text-left text-xs font-medium hover:brightness-95 sm:h-8",
                      tone(post),
                    )}
                  >
                    <PlatformLogo provider={post.provider} size="xs" />
                    {!compact && (
                      <span className="truncate tabular-nums">
                        {timeIn(post.scheduledAt, timeZone)}
                      </span>
                    )}
                  </button>
                </PostPopover>
              ))}
              {list.length > MONTH_CELL_POSTS && (
                <button
                  type="button"
                  onClick={() => toggle(day)}
                  className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {!compact && (expanded ? <CaretUp size={12} /> : <CaretDown size={12} />)}
                  {expanded
                    ? compact
                      ? "Less"
                      : "Show less"
                    : compact
                      ? `+${list.length - MONTH_CELL_POSTS}`
                      : `${list.length - MONTH_CELL_POSTS} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, today, byDay, accountById, timeZone, compact }: GridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // Seven columns on a phone leave each day too little room for a card's usual row.
  const narrow = compact && days.length > 3;
  // Posts by day and hour.
  const slots = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const day of days)
      for (const post of byDay.get(day) ?? []) {
        const key = `${day}:${hourOf(new Date(post.scheduledAt), timeZone)}`;
        map.set(key, [...(map.get(key) ?? []), post]);
      }
    return map;
  }, [byDay, days, timeZone]);
  const firstHour = useMemo(() => {
    const hours = [...slots.keys()].map((key) => Number(key.split(":")[1]));
    return Math.min(8, ...hours);
  }, [slots]);

  // Open on the working day, or earlier when a post is: once per set of days.
  const startKey = days[0];
  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`[data-hour="${firstHour}"]`);
    const head = box?.querySelector<HTMLElement>("[data-days]");
    if (box && row) box.scrollTop = row.offsetTop - (head?.offsetHeight ?? 0);
  }, [startKey, firstHour]);

  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  return (
    <div className={FRAME}>
      {/* The day row scrolls with the hours (sticky), so a scrollbar narrows both alike and
          the columns stay lined up. */}
      <div ref={scroller} className="relative max-h-[70vh] overflow-y-auto">
        <div
          data-days
          className="sticky top-0 z-10 grid border-b border-border bg-card"
          style={columns}
        >
          {days.map((day) => (
            <div
              key={day}
              className={cn(
                "border-r border-border py-2 text-center text-xs last:border-r-0 sm:text-sm",
                day === today
                  ? "font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]"
                  : "font-medium text-muted-foreground",
              )}
            >
              {compact ? (
                <span className="flex flex-col leading-tight">
                  {weekdayName(day, "short")}
                  <span className="tabular-nums">{dayOfMonth(day)}</span>
                </span>
              ) : (
                <>
                  {weekdayName(day, "long")}{" "}
                  <span className="ml-1 tabular-nums">{dayOfMonth(day)}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {HOURS.map((hour) => (
          <div
            key={hour}
            data-hour={hour}
            className="grid border-b border-border last:border-b-0"
            style={columns}
          >
            {days.map((day, index) => {
              const list = slots.get(`${day}:${hour}`) ?? [];
              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-16 min-w-0 flex-col gap-1.5 border-r border-border last:border-r-0",
                    narrow ? "p-0.5" : "p-1.5",
                    day < today && "bg-muted/50",
                  )}
                >
                  {index === 0 && hour % 2 === 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {hourLabel(hour)}
                    </span>
                  )}
                  {list.map((post) => (
                    <PostPopover
                      key={post.id}
                      post={post}
                      account={accountById.get(post.accountId)}
                      timeZone={timeZone}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex w-full min-w-0 flex-col gap-1 rounded-lg border text-left hover:brightness-95",
                          narrow ? "items-center p-1 text-center" : "p-1.5 sm:p-2",
                          tone(post),
                        )}
                      >
                        {/* A phone's week is narrow: the mark over the time, which wraps at its space. */}
                        <span
                          className={cn(
                            "flex gap-1.5 font-medium tabular-nums",
                            narrow
                              ? "flex-col items-center gap-0.5 text-[11px] leading-tight [overflow-wrap:normal]"
                              : "items-center text-xs",
                          )}
                        >
                          <PlatformLogo provider={post.provider} size="xs" />
                          {timeIn(post.scheduledAt, timeZone)}
                        </span>
                        {!compact && (
                          <span className="line-clamp-2 text-[13px] leading-snug break-words">
                            {postTitle(post)}
                          </span>
                        )}
                      </button>
                    </PostPopover>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A post's chip opens its details; they mount only while open, so a busy month stays light. */
function PostPopover({
  children,
  ...details
}: {
  post: Post;
  account: Account | undefined;
  timeZone: string;
  children: React.ReactElement;
}) {
  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverContent align="start" className="w-72">
        <PostDetails {...details} />
      </PopoverContent>
    </Popover>
  );
}

/** A post's details and what can be done with it, from the calendar. */
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
        {(post.status === "scheduled" || post.status === "paused") && (
          <Button size="sm" variant="ghost" onClick={() => cancel(post)}>
            <X /> Cancel
          </Button>
        )}
      </div>
    </>
  );
}
