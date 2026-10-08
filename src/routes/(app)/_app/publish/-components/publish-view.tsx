import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowCounterClockwise, ArrowSquareOut, CalendarBlank, X } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { FeedbackButton } from "#/components/modals/feedback-button";
import { Notice, Page, PageHeader, Panel } from "#/components/layouts/workspace-page";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Spinner } from "#/components/ui/spinner";
import {
  ACTIVE,
  postFormat,
  postTitle,
  statusOf,
  timeIn,
  type Post,
  type PublishData,
} from "../-lib/posts";
import { ChannelFilter, useChannelSelection, useViewerZone, ZoneFilter } from "./publish-filters";
import { usePostActions } from "./use-post-actions";

export type { PublishData };
type Tab = "queue" | "sent";
type TimelineItem =
  | { type: "day"; key: string; label: { day: string; date: string } }
  | { type: "post"; key: string; post: Post };

function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return `${value("year")}-${String(value("month")).padStart(2, "0")}-${String(value("day")).padStart(2, "0")}`;
}

function nextDay(key: string) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** "Thursday" and "1 October" — the day leads, the date is quieter. */
function dateLabel(key: string, today: string) {
  const at = new Date(`${key}T12:00:00Z`);
  // The key is a calendar date: read it back in UTC, whatever zone the runtime is in.
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(at);
  const date = format({ day: "numeric", month: "long" });
  if (key === today) return { day: "Today", date };
  if (key === nextDay(today)) return { day: "Tomorrow", date };
  return { day: format({ weekday: "long" }), date };
}

/** Timeline for agent-scheduled posts. Also rendered with sample data on the landing page. */
export function PublishView({
  accounts,
  posts,
  viewToggle,
}: PublishData & {
  /** The List / Calendar switch, in the workspace; the landing preview has none. */
  viewToggle?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("queue");
  const { selected, setSelected } = useChannelSelection(accounts);
  const [timeZone, setTimeZone] = useViewerZone();
  const { cancel, retry, retrying } = usePostActions();
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const today = dayKey(new Date(), timeZone);
  const visiblePosts = useMemo(
    () =>
      posts
        .filter(
          (post) =>
            selectedSet.has(post.accountId) &&
            (tab === "queue" ? ACTIVE.has(post.status) : post.status === "published"),
        )
        .sort((a, b) => {
          const aTime = new Date(
            tab === "sent" ? (a.publishedAt ?? a.scheduledAt) : a.scheduledAt,
          ).getTime();
          const bTime = new Date(
            tab === "sent" ? (b.publishedAt ?? b.scheduledAt) : b.scheduledAt,
          ).getTime();
          return tab === "queue" ? aTime - bTime : bTime - aTime;
        }),
    [posts, selectedSet, tab],
  );
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    let previousDay = "";
    for (const post of visiblePosts) {
      const date = new Date(
        tab === "sent" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt,
      );
      const day = dayKey(date, timeZone);
      if (day !== previousDay) {
        items.push({ type: "day", key: `day:${day}`, label: dateLabel(day, today) });
        previousDay = day;
      }
      items.push({ type: "post", key: `post:${post.id}`, post });
    }
    return items;
  }, [visiblePosts, tab, timeZone, today]);
  const { queueCount, sentCount } = useMemo(() => {
    let queueCount = 0;
    let sentCount = 0;
    for (const post of posts) {
      if (!selectedSet.has(post.accountId)) continue;
      if (ACTIVE.has(post.status)) queueCount++;
      if (post.status === "published") sentCount++;
    }
    return { queueCount, sentCount };
  }, [posts, selectedSet]);

  const postRow = (post: Post) => {
    const account = accountById.get(post.accountId);
    const date = new Date(
      tab === "sent" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt,
    );
    const status = statusOf(post);
    return (
      <article
        key={post.id}
        // On a phone the time sits above its post; wider, it gets a column of its own.
        className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[6.25rem_minmax(0,1fr)] sm:gap-4"
      >
        <time
          dateTime={date.toISOString()}
          className="text-[15px] font-medium tabular-nums text-foreground sm:pt-3.5 sm:text-right sm:text-sm"
        >
          {timeIn(date, timeZone)}
        </time>
        <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30">
          {account && (
            <ChannelAvatar
              provider={account.provider}
              avatar={account.avatar}
              name={account.name}
              size="sm"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{postTitle(post)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {account?.name ?? "Channel unavailable"}
              {postFormat(post) ? ` · ${postFormat(post)}` : ""}
            </p>
            {/* The whole reason, under the post: failed in red; a scheduled post that hit a
                hiccup says it will try again; anything else (e.g. not public yet) plainly. */}
            {post.error && (
              <p
                className={
                  post.status === "failed"
                    ? "mt-1 text-xs break-words text-destructive"
                    : "mt-1 text-xs break-words text-muted-foreground"
                }
              >
                {post.status === "scheduled" ? `Trying again: ${post.error}` : post.error}
              </p>
            )}
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
          {post.platformUrl && post.status !== "cancelled" && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open published post"
              render={<a href={post.platformUrl} target="_blank" rel="noreferrer" />}
            >
              <ArrowSquareOut />
            </Button>
          )}
          {(post.status === "scheduled" || post.status === "paused") && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Cancel scheduled post"
              onClick={() => cancel(post)}
            >
              <X />
            </Button>
          )}
          {(post.status === "failed" || post.status === "paused") && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Retry failed post"
              disabled={retrying === post.id}
              onClick={() => retry(post)}
            >
              {retrying === post.id ? <Spinner /> : <ArrowCounterClockwise />}
            </Button>
          )}
        </div>
      </article>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Publish"
        description="What your agents have scheduled, and what already went out."
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

      <Panel>
        <div className="min-h-[24rem] px-4 pb-8 pt-2 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
            <div role="tablist" aria-label="Publish timeline" className="flex items-center gap-4">
              {(["queue", "sent"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  onClick={() => setTab(item)}
                  className={`flex h-10 items-center gap-2 border-b-2 px-1.5 text-sm font-medium transition-colors ${tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {item === "queue" ? "Queue" : "Sent"}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none tabular-nums">
                    {item === "queue" ? queueCount : sentCount}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 pb-1">
              <ChannelFilter accounts={accounts} selected={selected} onChange={setSelected} />
              <ZoneFilter timeZone={timeZone} onChange={setTimeZone} />
            </div>
          </div>

          <div role="tabpanel" className="px-0 pt-5 sm:px-5">
            {timeline.length > 0 && (
              <div
                role="region"
                aria-label={`${tab === "queue" ? "Queued" : "Sent"} posts`}
                className="flex flex-col gap-2.5"
              >
                {timeline.map((item) =>
                  item.type === "day" ? (
                    <h2
                      key={item.key}
                      className="pb-1 pt-5 text-lg font-semibold text-foreground first:pt-0 sm:pt-3 sm:text-[15px]"
                    >
                      {item.label.day},{" "}
                      <span className="font-medium text-muted-foreground">{item.label.date}</span>
                    </h2>
                  ) : (
                    postRow(item.post)
                  ),
                )}
              </div>
            )}
            {timeline.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
                <CalendarBlank size={25} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {selected.length === 0
                    ? "No channels selected"
                    : tab === "queue"
                      ? "Nothing in the queue yet"
                      : "No sent posts yet"}
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {selected.length === 0
                    ? "Select one or more channels to see their posts."
                    : tab === "queue"
                      ? "Posts scheduled by your agent will appear here. Your agent can use an API key to publish."
                      : "Published posts for the selected channels will appear here."}
                </p>
                {tab === "queue" && selected.length > 0 && (
                  <Link
                    to="/api-keys"
                    className="mt-1 text-xs font-medium text-foreground underline underline-offset-4"
                  >
                    View API keys
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </Page>
  );
}
