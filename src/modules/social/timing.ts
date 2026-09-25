/**
 * When a post leaves mixetape, and when it goes live.
 *
 * Like Buffer, a post waits in mixetape — where it can still be edited, re-timed or
 * cancelled — until shortly before its time. For a platform that can hold a video itself
 * (YouTube's publishAt), mixetape uploads it `leadMinutes` early as private, so the
 * platform has finished processing the high-quality versions by the moment it goes public.
 * "Post now" is simply "go live `leadMinutes` from now".
 */

/** The lead times offered in the app; the API accepts any whole number up to the maximum. */
export const LEAD_CHOICES = [0, 15, 30, 60] as const;
export const MAX_LEAD_MINUTES = 240;

/** Below this, a publishAt would be too close to the upload to be worth using. */
const MIN_PUBLISH_AT_GAP_MS = 60_000;

export type Timing = {
  /** When to upload to the platform (ms since epoch). */
  uploadAt: number;
  /** The publishAt to give the platform, or undefined to publish on upload. */
  publishAt?: string;
};

/**
 * `native`: the platform can hold a post until a time. `privacy`: only a post meant to be
 * public is held and flipped public later; unlisted and private ones simply go up on time.
 */
export function publishTiming(input: {
  scheduledAt: number;
  leadMinutes: number;
  native: boolean;
  privacy?: string;
  now: number;
}): Timing {
  const holds = input.native && (input.privacy ?? "public") === "public" && input.leadMinutes > 0;
  if (!holds) return { uploadAt: input.scheduledAt };

  const uploadAt = input.scheduledAt - input.leadMinutes * 60_000;
  // A run that wakes late (a deploy, an outage) still honours the go-live time when there is
  // room for it, and otherwise publishes straight away rather than scheduling the past.
  const room = input.scheduledAt - Math.max(uploadAt, input.now);
  return room >= MIN_PUBLISH_AT_GAP_MS
    ? { uploadAt, publishAt: new Date(input.scheduledAt).toISOString() }
    : { uploadAt };
}

export function checkLead(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_LEAD_MINUTES) {
    throw new RangeError(`leadMinutes must be a whole number from 0 to ${MAX_LEAD_MINUTES}`);
  }
  return minutes;
}
