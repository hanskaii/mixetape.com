import type { JsonValue } from "#/database/schema";
import type { getTikTokCreators } from "#/modules/library/library.fn";

/**
 * TikTok's Direct Post rules for the post form (developers.tiktok.com content-sharing
 * guidelines), kept apart from the form so they can be tested.
 */

export type TikTokCreators = Awaited<ReturnType<typeof getTikTokCreators>>;
export type Values = Record<string, JsonValue>;

export const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

export const NO_DISCLOSURE =
  "You need to indicate if your content promotes yourself, a third party, or both.";
export const BRANDED_PRIVATE = "Branded content visibility cannot be set to private.";

/** The privacy levels every chosen account allows, in TikTok's order. */
export function sharedPrivacy(creators: TikTokCreators) {
  const [first, ...rest] = creators;
  return (first?.privacyLevelOptions ?? []).filter((level) =>
    rest.every((creator) => creator.privacyLevelOptions.includes(level)),
  );
}

/** Why TikTok's part of the post cannot go yet; null when it can. */
export function tiktokProblem({
  creators,
  loading,
  failed,
  values,
  disclose,
  videoMs,
}: {
  creators: TikTokCreators | undefined;
  loading: boolean;
  /** Why the creator info could not be read (an expired connection, TikTok down). */
  failed?: string | null;
  values: Values;
  disclose: boolean;
  videoMs: number | null;
}): string | null {
  if (failed) return failed;
  if (loading || !creators) return "Checking your TikTok account…";
  const blocked = creators.find((creator) => creator.blocked);
  if (blocked) return `${blocked.nickname}: ${blocked.blocked}`;
  const longest = creators
    .map((creator) => creator.maxVideoPostDurationSec)
    .filter((seconds): seconds is number => typeof seconds === "number");
  const limit = longest.length ? Math.min(...longest) : null;
  if (limit && videoMs && videoMs > limit * 1000)
    return `The video is longer than ${Math.floor(limit / 60)} min ${limit % 60} s, the most this TikTok account can post.`;
  const privacy = values.privacyLevel;
  if (typeof privacy !== "string" || !sharedPrivacy(creators).includes(privacy))
    return "Choose who can watch it on TikTok.";
  if (disclose && values.brandOrganic !== true && values.brandContent !== true)
    return NO_DISCLOSURE;
  if (values.brandContent === true && privacy === "SELF_ONLY") return BRANDED_PRIVATE;
  return null;
}

/** The consent line TikTok asks for next to the publish button. */
export function tiktokConsent(values: Values) {
  return values.brandContent === true
    ? "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
    : "By posting, you agree to TikTok's Music Usage Confirmation.";
}
