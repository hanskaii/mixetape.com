import type * as schema from "#/database/schema";
import type { JsonValue } from "#/database/schema";

/**
 * The contract every platform implements. A provider must be able to connect accounts,
 * check a post's metadata and upload it; everything else is an optional capability, and
 * mixetape (UI, REST, MCP) offers exactly the capabilities a provider has.
 *
 * Adding a platform: a folder in providers/ with a SocialProvider built from these pieces
 * (see youtube/), and one entry in providers/index.ts.
 */

export type Metadata = Record<string, JsonValue>;

// ── Errors ───────────────────────────────────────────────────────────────────

/** Errors a retry cannot fix; the scheduler fails the post at once instead of retrying. */
export class PermanentPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentPublishError";
  }
}

/** The caller asked for something the platform cannot take (a bad field, a missing title). */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

/** The platform no longer honours the account's tokens; only a new consent fixes it. */
export class ReconnectRequiredError extends Error {
  constructor(message = "Access was revoked or expired — reconnect the account") {
    super(message);
    this.name = "ReconnectRequiredError";
  }
}

// ── Connecting accounts ──────────────────────────────────────────────────────

/** mixetape's OAuth app at the platform, from the Secrets Store. */
export type AppCredentials = { clientId: string; clientSecret: string };

/** An account the consent gave access to — a YouTube channel, a Page, a profile. */
export type ConnectedAccount = {
  platformAccountId: string;
  name: string;
  handle?: string;
  avatar?: string;
  /** This account's own tokens, when they differ from the consent's (a Facebook Page's). */
  grant?: TokenGrant;
};

export type TokenGrant = {
  accessToken: string;
  refreshToken?: string;
  /** Seconds. */
  expiresIn: number;
  scopes: string[];
};

export interface ConnectCapability {
  /** The permissions mixetape asks for; an account granted fewer must reconnect. */
  readonly scopes: readonly string[];
  /** The platform's consent page for this app. */
  authorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string;
  /** Trades the callback's code for tokens and the accounts they reach. */
  exchangeCode(
    app: AppCredentials,
    input: { code: string; redirectUri: string },
  ): Promise<{ grant: TokenGrant; accounts: ConnectedAccount[] }>;
  /**
   * A fresh access token, and a new refresh token when the platform rotates it; throws
   * ReconnectRequiredError when the platform refuses.
   */
  refresh(
    app: AppCredentials,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }>;
  /**
   * The accounts a token reaches now, to keep their stored names and avatars current
   * (YouTube's policies allow keeping its data 30 days before it must be refreshed).
   */
  accounts?(token: string): Promise<ConnectedAccount[]>;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export interface MetadataSpec {
  /** JSON Schema of the post metadata, shown to agents (MCP) and API users. */
  readonly schema: Record<string, unknown>;
  /** Checks and normalises metadata for a new or edited post; throws InvalidInputError. */
  validate(input: Metadata, caption: string | null | undefined): Metadata;
}

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaKind = "video" | "image";

/** One file of a post, as stored (`r2://…` or https) with what kind it is. */
export type MediaItem = {
  url: string;
  kind: MediaKind;
  /** Its content type, when mixetape read the file (files in storage). */
  type?: string;
};

/**
 * What a platform takes in one post. A post with several files is a carousel (Instagram,
 * Threads, Pinterest) or an album (Facebook); mixetape checks a post against this before it
 * is scheduled, so a refusal shows up at once rather than at go-live.
 */
export interface MediaFormats {
  readonly video: boolean;
  readonly image: boolean;
  /** Several files in one post; absent when the platform takes one file per post. */
  readonly carousel?: { min: number; max: number; kinds: readonly MediaKind[] };
  /** Image content types the platform accepts, when it is pickier than "any image". */
  readonly imageTypes?: readonly string[];
  /**
   * Other image types mixetape turns into JPEG on the way (at the edge, from storage), so the
   * platform takes them anyway: a PNG for Instagram.
   */
  readonly convertsImages?: readonly string[];
  /** Video length the platform accepts, in milliseconds. */
  readonly minVideoMs?: number;
  readonly maxVideoMs?: number;
  /** Made for upright (9:16) media: a horizontal file is allowed but flagged. */
  readonly vertical?: boolean;
}

// ── Publishing ───────────────────────────────────────────────────────────────

/** A post row with its media resolved to URLs the provider can read. */
export type PostWithMedia = typeof schema.socialPosts.$inferSelect & {
  /** The first file; the only one unless the post is a carousel. */
  url: string;
  /** Every file, in order. */
  media: MediaItem[];
  caption?: string | null;
  platformAccountId?: string | null;
};

export interface UploadResult {
  platformPostId?: string;
  platformUrl?: string;
  responseLog?: string;
  /** What went wrong without failing the post (e.g. the thumbnail was refused). */
  warning?: string;
}

/** What the platform reports about a post right now. */
export type PlatformStatus = {
  /** e.g. YouTube: public | unlisted | private */
  visibility?: string;
  /** e.g. YouTube: uploaded | processed | failed | rejected | deleted */
  uploadStatus?: string;
  /** When the platform will publish it, if it is holding it. */
  publishAt?: string | null;
  /** Why the platform refused or failed it, if it did. */
  problem?: string | null;
  url?: string;
  /** Lifetime public counters. */
  counts?: { views?: number; likes?: number; comments?: number };
};

export interface StatusCapability {
  fetch(platformPostId: string, token: string): Promise<PlatformStatus | null>;
}

export interface ThumbnailCapability {
  /** Sets or replaces the custom thumbnail from a public image URL. */
  set(platformPostId: string, imageUrl: string, token: string): Promise<void>;
}

export interface EditingCapability {
  /** Metadata fields that can still change once the post is on the platform. */
  readonly fields: readonly string[];
  /** Applies the changes (only `fields`); throws InvalidInputError for anything else. */
  update(platformPostId: string, changes: Metadata, token: string): Promise<void>;
}

// ── Collections (YouTube playlists; boards elsewhere) ────────────────────────

export type Collection = {
  id: string;
  title: string;
  description?: string;
  visibility?: string;
  itemCount?: number;
  url?: string;
};

export interface CollectionsCapability {
  list(token: string): Promise<Collection[]>;
  create(
    token: string,
    input: { title: string; description?: string; visibility?: string },
  ): Promise<Collection>;
  /** Adds a post; position 0 puts it first, omitted puts it last. */
  add(
    token: string,
    collectionId: string,
    platformPostId: string,
    position?: number,
  ): Promise<void>;
}

// ── Captions ─────────────────────────────────────────────────────────────────

export type Caption = {
  id: string;
  language: string;
  name: string;
  kind?: string;
  isDraft?: boolean;
  status?: string;
};

export type CaptionInput = {
  /** BCP-47, e.g. "en", "id". */
  language: string;
  name?: string;
  /** Public https URL of an SRT or WebVTT file. */
  url: string;
  isDraft?: boolean;
};

export interface CaptionsCapability {
  list(platformPostId: string, token: string): Promise<Caption[]>;
  /** Uploads a track, replacing the one with the same language and name. */
  put(
    platformPostId: string,
    input: CaptionInput,
    token: string,
  ): Promise<Caption & { replaced: boolean }>;
}

// ── Comments ─────────────────────────────────────────────────────────────────

export type Comment = {
  id: string;
  author: string;
  authorAccountId?: string;
  text: string;
  likes: number;
  publishedAt: string;
  replyCount?: number;
  moderationStatus?: string;
  replies?: Comment[];
};

export type CommentModeration = "published" | "heldForReview" | "rejected";

export interface CommentsCapability {
  list(
    platformPostId: string,
    token: string,
    options: { limit: number; order: "time" | "relevance"; held: boolean },
  ): Promise<Comment[]>;
  /** A new top-level comment from the account itself. */
  post(platformPostId: string, text: string, token: string): Promise<Comment>;
  reply(commentId: string, text: string, token: string): Promise<Comment>;
  moderate(
    commentId: string,
    status: CommentModeration,
    token: string,
    options: { banAuthor: boolean },
  ): Promise<void>;
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** Dates are YYYY-MM-DD, inclusive, in the platform's reporting timezone. */
export type DateRange = { from: string; to: string };

export type Metrics = {
  views?: number;
  watchTimeMinutes?: number;
  averageViewDurationSeconds?: number;
  averageViewPercentage?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  subscribersGained?: number;
  subscribersLost?: number;
};

export type TrafficSource = { source: string; views: number; watchTimeMinutes: number };

export type PostAnalytics = {
  range: DateRange;
  totals: Metrics;
  /**
   * Audience retention: at each point of the video (0–1), the share of views still
   * watching, and how that compares with similar videos (0.5 = typical).
   */
  retention: { position: number; watchRatio: number; relativePerformance?: number }[];
  trafficSources: TrafficSource[];
};

export type AccountAnalytics = {
  range: DateRange;
  totals: Metrics;
  daily: (Metrics & { date: string })[];
  topPosts: (Metrics & { platformPostId: string })[];
  trafficSources: TrafficSource[];
};

export interface AnalyticsCapability {
  /** How long after publishing the numbers settle, so callers know recent days are partial. */
  readonly delayDays: number;
  post(platformPostId: string, token: string, range: DateRange): Promise<PostAnalytics>;
  /** Account-level reports; absent when the platform offers none worth reporting. */
  account?(platformAccountId: string, token: string, range: DateRange): Promise<AccountAnalytics>;
}

// ── The provider ─────────────────────────────────────────────────────────────

export interface SocialProvider {
  readonly id: string;
  readonly name: string;
  /**
   * True when the platform itself can hold a post until a given time. The scheduler then
   * uploads early and lets the platform publish; otherwise it uploads at the moment.
   */
  readonly schedulesNatively: boolean;
  /** For native scheduling: how long before go-live a post is uploaded by default. */
  readonly defaultLeadMinutes: number;
  /**
   * The smallest lead the platform can schedule with (0, "upload at go-live", is always
   * allowed): Facebook refuses a publish time under 10 minutes away.
   */
  readonly minLeadMinutes?: number;

  readonly connect: ConnectCapability;
  readonly metadata: MetadataSpec;
  readonly formats: MediaFormats;
  /**
   * Where a library group's title and description go in this platform's metadata (YouTube's
   * title and description, a Pin's title…). The caption always goes to the post's caption.
   */
  readonly textFields?: { title?: string; description?: string };
  /** Uploads the post; follow-ups that fail (thumbnail, playlists…) become a warning. */
  upload(post: PostWithMedia, token: string, metadata: Metadata): Promise<UploadResult>;
  /**
   * For a platform that cannot hold a post until a time itself (Instagram, Threads): with
   * a publishAt, upload only prepares the post (a processed media container) ahead of
   * time, and release publishes it at go-live, returning the live post.
   */
  release?(
    prepared: string,
    token: string,
    platformAccountId: string,
  ): Promise<{ platformPostId: string; platformUrl?: string }>;

  readonly status?: StatusCapability;
  readonly thumbnails?: ThumbnailCapability;
  readonly editing?: EditingCapability;
  readonly collections?: CollectionsCapability;
  readonly captions?: CaptionsCapability;
  readonly comments?: CommentsCapability;
  readonly analytics?: AnalyticsCapability;
}

export type Capability =
  | "status"
  | "thumbnails"
  | "editing"
  | "collections"
  | "captions"
  | "comments"
  | "analytics";

export const CAPABILITIES: readonly Capability[] = [
  "status",
  "thumbnails",
  "editing",
  "collections",
  "captions",
  "comments",
  "analytics",
];
