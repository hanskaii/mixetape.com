/**
 * The platforms mixetape posts to, as the docs show them. The OpenAPI document (each
 * operation's `x-platforms`) and the tool catalog (each tool's `platforms`) say where an
 * action works; these name and draw them.
 */
export const PLATFORMS = [
  { id: "youtube", name: "YouTube", icon: "youtube" },
  { id: "facebook", name: "Facebook", icon: "facebook" },
  { id: "instagram", name: "Instagram", icon: "instagram" },
  { id: "threads", name: "Threads", icon: "threads" },
  { id: "tiktok", name: "TikTok", icon: "tiktok" },
  { id: "pinterest", name: "Pinterest", icon: "pinterest" },
  { id: "bluesky", name: "Bluesky", icon: "bluesky" },
  { id: "mastodon", name: "Mastodon", icon: "mastodon" },
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** The platforms among these ids, in the usual order; every one when none are given. */
export function platformsOf(ids: readonly string[] | undefined): Platform[] {
  return ids ? PLATFORMS.filter((platform) => ids.includes(platform.id)) : [...PLATFORMS];
}

export const isEveryPlatform = (ids: readonly string[] | undefined) =>
  platformsOf(ids).length === PLATFORMS.length;

/** "All platforms", or the names joined: for text outputs and labels. */
export function platformLabel(ids: readonly string[] | undefined) {
  return isEveryPlatform(ids)
    ? "All platforms"
    : platformsOf(ids)
        .map((platform) => platform.name)
        .join(", ");
}
