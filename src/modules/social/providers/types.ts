import type * as schema from "#/database/schema";

// ── Per-platform metadata ────────────────────────────────────────────────────

export type YouTubeVideoMeta = {
  title: string;
  description?: string;
  /** YouTube category id, e.g. "27" Education, "22" People & Blogs. */
  category?: string;
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
  madeForKids?: boolean;
  notifySubscribers?: boolean;
  /**
   * ISO time for YouTube to publish the video. Set by the scheduler, not by callers: the
   * video is uploaded as private right away and YouTube makes it public at this moment,
   * so processing is finished long before it goes live.
   */
  publishAt?: string;
};

export type PlatformMetadata = YouTubeVideoMeta;

// ── Provider contract ────────────────────────────────────────────────────────

// Post row enriched with a resolved media URL (from R2) and per-platform fields
export type PostWithMedia = typeof schema.socialPosts.$inferSelect & {
  url: string;
  thumbnail?: string | null;
  caption?: string | null;
  // The external platform account ID (e.g. YouTube channel ID, TikTok open_id)
  platformAccountId?: string | null;
};

export interface UploadResult {
  platformPostId?: string;
  platformUrl?: string;
  responseLog?: string;
}

export type PlatformMetrics = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
  saves?: number;
  raw: unknown;
};

export interface SocialProvider {
  readonly id: string;
  readonly name: string;
  /**
   * True when the platform itself can hold a post until a given time. The scheduler then
   * uploads at once and lets the platform publish; otherwise it waits and uploads at the
   * scheduled moment.
   */
  readonly schedulesNatively: boolean;

  upload(
    post: PostWithMedia,
    accessToken: string,
    clientKey: string,
    secretKey: string,
    metadata: PlatformMetadata,
  ): Promise<UploadResult>;

  refreshToken?(
    refreshToken: string,
    clientKey: string,
    secretKey: string,
  ): Promise<{ accessToken: string; expiresIn: number }>;

  fetchAnalytics?(
    platformPostId: string,
    accessToken: string,
    accountId: string,
  ): Promise<PlatformMetrics | null>;
}

/** Errors a retry cannot fix; the scheduler fails the post at once instead of retrying. */
export class PermanentPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentPublishError";
  }
}
