import type { getCalendarPosts, getPublishAccounts } from "../-fn/calendar.fn";

export type Post = Awaited<ReturnType<typeof getCalendarPosts>>[number];
export type Account = Awaited<ReturnType<typeof getPublishAccounts>>[number];
/** What the Publish board shows; also rendered with sample data on the landing page. */
export type PublishData = { accounts: Account[]; posts: Post[] };

export const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  scheduled: { label: "Scheduled", variant: "outline" },
  publishing: { label: "Publishing", variant: "secondary" },
  uploaded: { label: "Uploaded", variant: "secondary" },
  published: { label: "Sent", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  // Due while the plan had ended: kept, and can be sent again once there is a plan.
  paused: { label: "Paused", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export const statusOf = (post: Post) =>
  STATUS[post.status] ?? { label: post.status, variant: "outline" as const };

/** What a post is, when it is more than a video: "Carousel · 4", "Photo". */
export function postFormat(post: Post) {
  const media = post.media ?? [];
  if (media.length > 1) return `Carousel · ${media.length}`;
  return media[0]?.kind === "image" ? "Photo" : null;
}

export function postTitle(post: Post) {
  return (post.metadata as { title?: string } | null)?.title ?? post.caption ?? "Untitled post";
}

/** "5:30 PM" in the viewer's zone. */
export const timeIn = (date: Date | string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    new Date(date),
  );

export const COMMON_ZONES = [
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

/** The zone the page renders in on the server; the viewer's own replaces it once mounted. */
export const DEFAULT_ZONE = "Asia/Jakarta";

export function zoneLabel(zone: string) {
  return zone === "UTC" ? "UTC" : (zone.split("/").at(-1)?.replaceAll("_", " ") ?? zone);
}
