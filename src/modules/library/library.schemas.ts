import { object } from "#/modules/api/input";
import { FILE } from "#/modules/storage/storage.schemas";

/**
 * JSON Schemas for library groups: the fields MCP tools and REST endpoints both take, and
 * what REST answers.
 */

const ids = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const GROUP_FIELDS = {
  title: { type: "string", description: "Title where the platform has one (YouTube, Pinterest)" },
  caption: { type: "string", description: "The post text; the default on every platform" },
  description: { type: "string", description: "Longer description where the platform has one" },
  fileIds: ids(
    "Files from storage, in order — a carousel's order. Each must be ready (its upload finished); a file in another group moves here. On update this replaces the group's files; the ones left out stay in storage.",
  ),
  metadata: {
    type: "object",
    description:
      "Fields every platform shares (tags, thumbnailUrl, firstComment, …) and platforms: { youtube: { … }, instagram: { … } } with each platform's overrides (the same fields as a post's metadata on that platform; a caption there replaces the caption on that platform). On update it is merged; null clears a field or a platform.",
  },
};

/** Files picked for one post without a group: the files, and the words for them. */
export const SELECTION_FIELDS = {
  fileIds: ids(
    "Files from storage, in order — several make a carousel or album. Each must be ready (its upload finished).",
  ),
  title: GROUP_FIELDS.title,
  caption: GROUP_FIELDS.caption,
  description: GROUP_FIELDS.description,
  metadata: {
    ...GROUP_FIELDS.metadata,
    description:
      "Fields every platform shares (tags, thumbnailUrl, firstComment, …) and platforms: { youtube: { … }, instagram: { … } } with each platform's overrides.",
  },
};

export const GROUP_FILTERS = {
  search: { type: "string", description: "Words in the title, caption or description" },
  limit: { type: "integer", minimum: 1, maximum: 200, description: "Groups per page, default 50" },
  cursor: { type: "string", description: "nextCursor from the previous page" },
};

export const TARGET = {
  brandIds: ids("Brands: every channel in them"),
  accountIds: ids("Single channels"),
};

export const PUBLISH_OPTIONS = {
  scheduledAt: {
    type: "string",
    format: "date-time",
    description: "ISO 8601 with a timezone offset; left out, each post goes live after its lead",
  },
  leadMinutes: {
    type: "integer",
    minimum: 0,
    description: "The same lead for every channel; left out, each platform keeps its default",
  },
};

const STRING = { type: "string" };
const DATE_TIME = { type: "string", format: "date-time" };
const NULLABLE_STRING = { type: ["string", "null"] };
const STRINGS = { type: "array", items: STRING };

export const GROUP = object(
  {
    id: STRING,
    title: NULLABLE_STRING,
    caption: NULLABLE_STRING,
    description: NULLABLE_STRING,
    metadata: { type: "object" },
    files: { type: "array", items: FILE, description: "Its ready files, in order" },
    posts: {
      type: "array",
      description: "The posts published from it",
      items: object({
        id: STRING,
        accountId: STRING,
        provider: STRING,
        status: STRING,
        scheduledAt: DATE_TIME,
        platformUrl: NULLABLE_STRING,
      }),
    },
    createdBy: { type: "string", enum: ["agent", "user"], description: "Who made it" },
    createdAt: DATE_TIME,
    updatedAt: DATE_TIME,
  },
  ["id", "metadata", "files", "posts", "createdBy", "createdAt", "updatedAt"],
);

const CHANNEL = { accountId: STRING, name: STRING, provider: STRING };

export const PLAN = object(
  {
    channels: {
      type: "array",
      items: object(
        {
          ...CHANNEL,
          platform: STRING,
          brands: { ...STRINGS, description: "The chosen brands this channel is in" },
          fits: { type: "boolean", description: "The platform takes these files at all" },
          ready: { type: "boolean", description: "Nothing stops it: it would be posted" },
          format: { type: ["string", "null"], enum: ["video", "image", "carousel", null] },
          label: { type: "string", description: "What it is there: Short, Reel, Carousel, Album…" },
          problems: { ...STRINGS, description: "What stops it" },
          warnings: { ...STRINGS, description: "What would go out, but not ideally" },
          caption: NULLABLE_STRING,
          metadata: { type: "object", description: "What the post would carry" },
        },
        ["accountId", "provider", "fits", "ready", "label", "problems", "warnings"],
      ),
    },
  },
  ["channels"],
);

export const PUBLISHED = object(
  {
    scheduled: { type: "array", items: object({ ...CHANNEL, postId: STRING }) },
    skipped: { type: "array", items: object({ ...CHANNEL, problems: STRINGS }) },
    failed: { type: "array", items: object({ ...CHANNEL, error: STRING }) },
  },
  ["scheduled", "skipped", "failed"],
);
