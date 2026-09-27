import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  ChatCircleDots,
  Globe,
  SpinnerGap,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { Textarea } from "#/components/ui/textarea";
import { Notice, Page, PageHeader, Panel } from "#/components/layouts/workspace-page";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { PlatformLogo } from "../../channels/-components/platform-logo";
import { cancelScheduledPost, getQueueData, retryFailedPost } from "#/modules/social/social.fn";

export type PublishData = Awaited<ReturnType<typeof getQueueData>>;
type Post = PublishData["posts"][number];
type Tab = "queue" | "sent";
type TimelineItem =
  | { type: "day"; key: string; label: string }
  | { type: "post"; key: string; post: Post };

const ACTIVE = new Set(["scheduled", "publishing", "uploaded", "failed"]);
const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  scheduled: { label: "Scheduled", variant: "outline" },
  publishing: { label: "Publishing", variant: "secondary" },
  uploaded: { label: "Uploaded", variant: "secondary" },
  published: { label: "Sent", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const COMMON_ZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

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

function dateLabel(key: string, today: string) {
  const date = new Date(`${key}T12:00:00Z`);
  // The key is a calendar date: read it back in UTC, whatever zone the runtime is in.
  const full = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  if (key === today) return `Today, ${full.replace(/^\w+, /, "")}`;
  if (key === nextDay(today)) return `Tomorrow, ${full.replace(/^\w+, /, "")}`;
  return full;
}

function zoneLabel(zone: string) {
  return zone === "UTC" ? "UTC" : (zone.split("/").at(-1)?.replaceAll("_", " ") ?? zone);
}

function postTitle(post: Post) {
  return (post.metadata as { title?: string } | null)?.title ?? post.caption ?? "Untitled post";
}

/** Timeline for agent-scheduled posts. Also rendered with sample data on the landing page. */
export function PublishView({ accounts, posts }: PublishData) {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const [tab, setTab] = useState<Tab>("queue");
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [timeZone, setTimeZone] = useState("Asia/Jakarta");
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  // Rendered on the server in a fixed zone, then shown in the viewer's own once it mounts.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) setTimeZone(zone);
  }, []);
  const selected = useMemo(
    () => selectedIds ?? accounts.map((account) => account.id),
    [accounts, selectedIds],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const zones = useMemo(
    () => [...new Set([...COMMON_ZONES, ...Intl.supportedValuesOf("timeZone")])],
    [],
  );
  const filteredZones = zones.filter((zone) =>
    `${zone} ${zoneLabel(zone)}`.toLowerCase().includes(zoneSearch.toLowerCase()),
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
  const toggleAccount = (id: string) => {
    setSelectedIds(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  };
  const cancel = (post: Post) =>
    confirm({
      title: "Cancel this post?",
      description: "It will not be uploaded. Your agent can schedule it again.",
      confirmText: "Cancel post",
      variant: "destructive",
      onConfirm: async () => {
        await cancelScheduledPost({ data: { id: post.id } });
        await router.invalidate();
      },
    });
  const retry = async (post: Post) => {
    setRetrying(post.id);
    try {
      await retryFailedPost({ data: { id: post.id } });
      await router.invalidate();
    } finally {
      setRetrying(null);
    }
  };

  const postRow = (post: Post) => {
    const account = accountById.get(post.accountId);
    const date = new Date(
      tab === "sent" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt,
    );
    const status = STATUS[post.status] ?? { label: post.status, variant: "outline" as const };
    return (
      <article
        key={post.id}
        className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[6.25rem_minmax(0,1fr)] sm:gap-4"
      >
        <time
          dateTime={date.toISOString()}
          className="pt-3.5 text-right text-sm font-medium tabular-nums text-foreground"
        >
          {new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour: "numeric",
            minute: "2-digit",
          }).format(date)}
        </time>
        <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30">
          {account && <PlatformLogo provider={account.provider} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{postTitle(post)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {account?.name ?? "Channel unavailable"}
              {post.error ? ` · ${post.error}` : ""}
            </p>
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
          {post.status === "scheduled" && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Cancel scheduled post"
              onClick={() => cancel(post)}
            >
              <X />
            </Button>
          )}
          {post.status === "failed" && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Retry failed post"
              disabled={retrying === post.id}
              onClick={() => retry(post)}
            >
              {retrying === post.id ? (
                <SpinnerGap className="animate-spin" />
              ) : (
                <ArrowCounterClockwise />
              )}
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
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Give feedback"
            title="Give feedback"
            onClick={() => setFeedbackOpen(true)}
          >
            <ChatCircleDots size={19} />
          </Button>
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <SquaresFour size={17} />{" "}
                      {selected.length === accounts.length
                        ? "Channels"
                        : `Channels (${selected.length})`}{" "}
                      <CaretDown size={13} />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="max-h-72 min-w-56">
                  <DropdownMenuItem
                    onClick={() =>
                      setSelectedIds(
                        selected.length === accounts.length
                          ? []
                          : accounts.map((account) => account.id),
                      )
                    }
                  >
                    {selected.length === accounts.length ? "Clear selection" : "Select all"}
                  </DropdownMenuItem>
                  {accounts.map((account) => (
                    <DropdownMenuCheckboxItem
                      key={account.id}
                      checked={selected.includes(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    >
                      <PlatformLogo provider={account.provider} size="sm" />{" "}
                      <span className="truncate">{account.name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  {accounts.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No channels connected</p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover open={zoneOpen} onOpenChange={setZoneOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Globe size={17} /> {zoneLabel(timeZone)} <CaretDown size={13} />
                    </button>
                  }
                />
                <PopoverContent align="end" className="w-64">
                  <label
                    htmlFor="publish-timezone-search"
                    className="px-1 text-xs font-medium text-muted-foreground"
                  >
                    Timezone
                  </label>
                  <input
                    id="publish-timezone-search"
                    type="search"
                    value={zoneSearch}
                    onChange={(event) => setZoneSearch(event.target.value)}
                    placeholder="Search city or region"
                    className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
                  />
                  <div className="max-h-56 overflow-y-auto" role="listbox" aria-label="Timezone">
                    {filteredZones.map((zone) => (
                      <button
                        key={zone}
                        type="button"
                        role="option"
                        aria-selected={zone === timeZone}
                        onClick={() => {
                          setTimeZone(zone);
                          setZoneOpen(false);
                          setZoneSearch("");
                        }}
                        className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${zone === timeZone ? "bg-muted font-semibold" : ""}`}
                      >
                        {zone.replaceAll("_", " ")}
                      </button>
                    ))}
                    {filteredZones.length === 0 && (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        No matching timezone
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
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
                      className="pb-1 pt-3 text-[15px] font-semibold text-foreground first:pt-0"
                    >
                      {item.label}
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

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            <DialogDescription>
              Tell us what would make publishing easier for you.
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Your feedback" placeholder="Your feedback..." rows={4} />
          <p className="text-xs text-muted-foreground">Feedback submission is coming soon.</p>
          <Button disabled>Send feedback</Button>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
