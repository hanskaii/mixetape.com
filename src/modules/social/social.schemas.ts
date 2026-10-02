import { object } from "#/modules/api/input";
import { PROVIDER_LIST, getProvider } from "./providers";

/**
 * JSON Schemas for accounts, posts, brands and connecting: the fields MCP tools and REST
 * endpoints both take, and what REST answers. Descriptions stay neutral — they say what a
 * field is, not which tool or endpoint to call.
 */

// ── fields ───────────────────────────────────────────────────────────────────

export const PLATFORMS = PROVIDER_LIST.map((provider) => provider.id);

/** Each platform's metadata schema, optionally cut down to some fields. */
function metadataSchema(pick?: (provider: string) => readonly string[] | undefined) {
  const schemas = PROVIDER_LIST.map(({ id, name }) => {
    const schema = getProvider(id).metadata.schema as { properties?: Record<string, unknown> };
    const fields = pick?.(id);
    const properties = fields
      ? Object.fromEntries(
          Object.entries(schema.properties ?? {}).filter(([key]) => fields.includes(key)),
        )
      : schema.properties;
    return { ...schema, title: name, properties };
  });
  return schemas.length === 1 ? schemas[0] : { anyOf: schemas };
}

export const METADATA = metadataSchema();
export const LIVE_METADATA = metadataSchema(
  (provider) => getProvider(provider).editing?.fields ?? [],
);

const TIME = (what: string) => ({
  type: "string",
  format: "date-time",
  description: `${what}: ISO 8601 with a timezone offset`,
});
export const DAY = (what: string) => ({ type: "string", format: "date", description: what });

const ids = (description: string) => ({ type: "array", items: { type: "string" }, description });

/** What a post carries; create takes them all, update the ones that change. */
export const POST_FIELDS = {
  mediaUrl: {
    type: "string",
    description: "One file: a public https URL, or an r2:// URL from mixetape storage",
  },
  media: ids(
    "Several files in one post, in order (https or r2:// URLs) — a carousel or photo album. Use instead of mediaUrl.",
  ),
  caption: { type: "string" },
  scheduledAt: TIME("When it goes live; left out, it goes live once the lead has passed"),
  leadMinutes: {
    type: "integer",
    minimum: 0,
    description:
      "How long before scheduledAt mixetape uploads or prepares it, so the platform finishes processing first. Defaults: YouTube and Facebook 30, Instagram 15, Threads 10; TikTok and Pinterest always 0. Facebook takes 0 or at least 15.",
  },
  metadata: METADATA,
};

export const POST_FILTERS = {
  accountId: ids("Only posts on these accounts"),
  provider: ids("Only posts on these platforms, e.g. youtube, instagram"),
  status: {
    type: "array",
    items: {
      type: "string",
      enum: ["scheduled", "publishing", "uploaded", "published", "failed", "cancelled"],
    },
    description: "Only posts in these statuses",
  },
  groupId: { type: "string", description: "Only posts published from this library group" },
  search: { type: "string", description: "Words in the title, caption or description" },
  from: TIME("Scheduled at or after"),
  to: TIME("Scheduled at or before"),
  updatedSince: TIME(
    "Changed at or after — status, error, time or words. Poll with the time of your last check to see what went out or failed since",
  ),
  limit: { type: "integer", minimum: 1, maximum: 500, description: "Posts per page, default 50" },
  cursor: { type: "string", description: "nextCursor from the previous page" },
};

export const COLLECTION_FIELDS = {
  title: { type: "string" },
  description: { type: "string" },
  visibility: { type: "string", enum: ["public", "unlisted", "private"] },
};

export const CAPTION_FIELDS = {
  language: { type: "string", description: 'BCP-47, e.g. "en", "id"' },
  name: { type: "string", description: "Track name; empty is the default track" },
  url: { type: "string", description: "A public https SRT (or WebVTT on YouTube) file" },
  isDraft: { type: "boolean", description: "Upload without publishing the track" },
};

export const COMMENT_FILTERS = {
  limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 20" },
  order: { type: "string", enum: ["time", "relevance"] },
  held: { type: "boolean", description: "Only comments held for review" },
};

export const MODERATION = {
  status: { type: "string", enum: ["published", "heldForReview", "rejected"] },
  banAuthor: {
    type: "boolean",
    description: "With rejected, also hide the author's future comments",
  },
};

export const BRAND_FIELDS = {
  name: { type: "string" },
  accountIds: ids("The brand's channels; on update this replaces the whole list"),
};

export const RANGE = { from: DAY("First day"), to: DAY("Last day") };

// ── responses ────────────────────────────────────────────────────────────────

const nullable = (schema: Record<string, unknown>) => ({
  ...schema,
  type: [schema.type as string, "null"],
});
const STRING = { type: "string" };
const DATE_TIME = { type: "string", format: "date-time" };

export const ACCOUNT = object(
  {
    id: { type: "string", description: "mixetape account id" },
    provider: { type: "string", enum: PLATFORMS },
    platformAccountId: { type: "string", description: "The platform's own id" },
    name: STRING,
    handle: nullable(STRING),
    status: {
      type: "string",
      enum: ["active", "reconnect"],
      description: "reconnect: connect the channel again before posting to it",
    },
    capabilities: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "status",
          "thumbnails",
          "editing",
          "collections",
          "captions",
          "comments",
          "analytics",
        ],
      },
      description: "What its platform supports beyond posting",
    },
    formats: {
      type: "object",
      description:
        "What one post can hold there: video, image, a carousel (min–max files and kinds), image types, video length, upright",
    },
  },
  ["id", "provider", "platformAccountId", "name", "status", "capabilities", "formats"],
);

export const POST = object(
  {
    id: STRING,
    accountId: STRING,
    provider: STRING,
    mediaUrl: { type: "string", description: "The first file" },
    media: {
      type: "array",
      description: "Every file, in order",
      items: object({ url: STRING, kind: { type: "string", enum: ["video", "image"] } }, [
        "url",
        "kind",
      ]),
    },
    groupId: nullable({ type: "string", description: "The library group it came from" }),
    caption: nullable(STRING),
    metadata: { type: ["object", "null"], description: "The platform's own fields" },
    scheduledAt: { ...DATE_TIME, description: "When it goes live" },
    leadMinutes: nullable({ type: "integer", description: "Sent this long before scheduledAt" }),
    status: {
      type: "string",
      enum: ["scheduled", "publishing", "uploaded", "published", "failed", "cancelled"],
      description:
        "scheduled: waiting in mixetape, still editable; publishing: on its way; uploaded: on the platform, live at scheduledAt; published: live; failed: see error",
    },
    platformPostId: nullable(STRING),
    platformUrl: nullable(STRING),
    error: nullable({ type: "string", description: "Why it failed, when it did" }),
    attempts: { type: "integer" },
    publishedAt: nullable(DATE_TIME),
    createdAt: DATE_TIME,
    updatedAt: DATE_TIME,
  },
  ["id", "accountId", "provider", "mediaUrl", "media", "scheduledAt", "status", "attempts"],
);

export const PLATFORM_STATUS = object({
  visibility: { type: "string", description: "e.g. public, unlisted, private" },
  uploadStatus: { type: "string", description: "e.g. uploaded, processed, failed, rejected" },
  publishAt: { ...nullable(DATE_TIME), description: "When the platform will publish it" },
  problem: nullable({ type: "string", description: "Why the platform refused or failed it" }),
  url: STRING,
  counts: object({
    views: { type: "integer" },
    likes: { type: "integer" },
    comments: { type: "integer" },
  }),
});

export const COLLECTION = object(
  {
    id: STRING,
    title: STRING,
    description: STRING,
    visibility: STRING,
    itemCount: { type: "integer" },
    url: STRING,
  },
  ["id", "title"],
);

export const CAPTION = object(
  {
    id: STRING,
    language: STRING,
    name: STRING,
    kind: { type: "string", description: "asr: generated automatically" },
    isDraft: { type: "boolean" },
    status: STRING,
  },
  ["id", "language", "name"],
);

const COMMENT_FIELDS = {
  id: { type: "string", description: "The id replies and moderation take" },
  author: STRING,
  text: STRING,
  likes: { type: "integer" },
  publishedAt: DATE_TIME,
  replyCount: { type: "integer" },
  moderationStatus: STRING,
};
export const COMMENT = object(
  {
    ...COMMENT_FIELDS,
    replies: { type: "array", items: object(COMMENT_FIELDS, ["id", "author", "text"]) },
  },
  ["id", "author", "text", "likes", "publishedAt"],
);

export const BRAND = object(
  { id: STRING, name: STRING, accountIds: { type: "array", items: STRING }, createdAt: DATE_TIME },
  ["id", "name", "accountIds"],
);

export const CONNECT_STARTED = object(
  {
    url: { type: "string", description: "The platform's sign-in page; works once, for 10 minutes" },
    state: { type: "string", description: "Follows the attempt" },
    expiresAt: DATE_TIME,
  },
  ["url", "state", "expiresAt"],
);

export const CONNECT_RESULT = object(
  {
    status: {
      type: "string",
      enum: ["pending", "done", "choose", "error"],
      description:
        "pending: not finished yet; done: channels were connected; choose: the sign-in reached several new channels, pick some; error: see error",
    },
    channels: { type: "array", items: STRING, description: "done: the channels connected" },
    refreshed: {
      type: "array",
      items: STRING,
      description: "choose: channels already connected that got new access",
    },
    choices: {
      type: "array",
      description: "choose: the new channels to pick from",
      items: object({ platformAccountId: STRING, name: STRING, handle: STRING, avatar: STRING }, [
        "platformAccountId",
        "name",
      ]),
    },
    error: STRING,
  },
  ["status"],
);

const METRICS = {
  views: { type: "integer" },
  watchTimeMinutes: { type: "number" },
  averageViewDurationSeconds: { type: "number" },
  averageViewPercentage: { type: "number" },
  likes: { type: "integer" },
  comments: { type: "integer" },
  shares: { type: "integer" },
  subscribersGained: { type: "integer" },
  subscribersLost: { type: "integer" },
};
const RANGE_OUT = object(
  { from: { type: "string", format: "date" }, to: { type: "string", format: "date" } },
  ["from", "to"],
);
const TRAFFIC = {
  type: "array",
  items: object({
    source: STRING,
    views: { type: "integer" },
    watchTimeMinutes: { type: "number" },
  }),
};
const DELAY = {
  type: "integer",
  description: "The last this many days are still incomplete on the platform",
};

export const POST_ANALYTICS = object(
  {
    post: object({ id: STRING, platformPostId: STRING, platformUrl: nullable(STRING) }),
    dataDelayDays: DELAY,
    range: RANGE_OUT,
    totals: object(METRICS),
    retention: {
      type: "array",
      description:
        "Audience retention: at each point of the video (0–1), the share of viewers still watching, and how that compares with similar videos (0.5 = typical)",
      items: object({
        position: { type: "number" },
        watchRatio: { type: "number" },
        relativePerformance: { type: "number" },
      }),
    },
    trafficSources: TRAFFIC,
  },
  ["post", "dataDelayDays", "range", "totals"],
);

export const ACCOUNT_ANALYTICS = object(
  {
    account: object({ id: STRING, name: STRING, provider: STRING }),
    dataDelayDays: DELAY,
    range: RANGE_OUT,
    totals: object(METRICS),
    daily: {
      type: "array",
      items: object({ date: { type: "string", format: "date" }, ...METRICS }),
    },
    topPosts: {
      type: "array",
      description: "With the mixetape post id when it was published through mixetape",
      items: object({ platformPostId: STRING, postId: nullable(STRING), ...METRICS }),
    },
    trafficSources: TRAFFIC,
  },
  ["account", "dataDelayDays", "range", "totals", "daily", "topPosts"],
);
