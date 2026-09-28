import { object, READ_ONLY, type Tool } from "#/modules/api/tool";
import * as library from "./library.service";
import * as schedule from "./schedule.service";

/**
 * The library for agents: content items — files from storage plus the metadata written for
 * them — made ahead, then sent to brands and channels (plan_item, schedule_item).
 */

const ITEM_ID = { type: "string", description: "Content item id (list_items)" };
const FIELDS = {
  title: { type: "string", description: "Title where the platform has one (YouTube, Pinterest)" },
  caption: { type: "string", description: "The post text; defaults for every platform" },
  description: { type: "string", description: "Longer description where the platform has one" },
  fileIds: {
    type: "array",
    items: { type: "string" },
    description:
      "Files from storage (list_files ids), in order — one video or image, or several for a carousel. Each must be ready (finish_upload done).",
  },
  metadata: {
    type: "object",
    description:
      "Fields every platform shares (tags, thumbnailUrl, firstComment, …) and platforms: { youtube: { … }, facebook: { … } } with each platform's overrides (same fields as create_post's metadata for that platform). On update it is merged; null clears a field or a platform.",
  },
};

const TARGET = {
  brandIds: {
    type: "array",
    items: { type: "string" },
    description: "Brands (list_brands): every channel in them",
  },
  accountIds: {
    type: "array",
    items: { type: "string" },
    description: "Single channels (list_accounts)",
  },
};

const target = (input: Parameters<Tool["run"]>[1]) => ({
  brandIds: input.strings("brandIds"),
  accountIds: input.strings("accountIds"),
});

export const libraryTools: Tool[] = [
  {
    name: "create_item",
    scope: "library",
    description:
      "Put content in the library without scheduling it: files from storage plus the title, caption and metadata you wrote. The user sees it in the workspace (Library) and can send it to channels or a brand later. Answers the item with its files (kind, size, orientation, duration).",
    inputSchema: object(FIELDS),
    run: (userId, input) =>
      library.createItem(
        userId,
        {
          title: input.optionalString("title"),
          caption: input.optionalString("caption"),
          description: input.optionalString("description"),
          fileIds: input.strings("fileIds"),
          metadata: input.object("metadata"),
        },
        "agent",
      ),
  },
  {
    name: "update_item",
    scope: "library",
    description:
      "Change a library item: the given fields only (null clears one); fileIds, when given, replaces the files and their order; metadata is merged.",
    inputSchema: object({ id: ITEM_ID, ...FIELDS }, ["id"]),
    run: (userId, input) => {
      const text = (name: string) => (input.raw(name) === null ? null : input.optionalString(name));
      return library.updateItem(userId, input.string("id"), {
        title: text("title"),
        caption: text("caption"),
        description: text("description"),
        fileIds: input.strings("fileIds"),
        metadata: input.raw("metadata") === null ? null : input.object("metadata"),
      });
    },
  },
  {
    name: "get_item",
    scope: "library",
    description: "One library item with its files and metadata.",
    inputSchema: object({ id: ITEM_ID }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) => library.getItem(userId, input.string("id")),
  },
  {
    name: "list_items",
    scope: "library",
    description:
      "List the library's content items, newest first, with their files — narrowed by words in the title, caption or description. Returns { items, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object({
      search: { type: "string", description: "Words in the title, caption or description" },
      limit: { type: "number", description: "Items per page: default 50, max 200" },
      cursor: { type: "string", description: "nextCursor from the previous page" },
    }),
    annotations: READ_ONLY,
    run: (userId, input) =>
      library.listItems(userId, {
        search: input.optionalString("search"),
        limit: input.number("limit"),
        cursor: input.optionalString("cursor"),
      }),
  },
  {
    name: "delete_item",
    scope: "library",
    description: "Delete a library item. Its files stay in storage.",
    inputSchema: object({ id: ITEM_ID }, ["id"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => library.deleteItem(userId, input.string("id")),
  },
  {
    name: "plan_item",
    scope: "library",
    description:
      "Before scheduling a library item: for each channel of the given brands and channels, whether it can go there and exactly what would be posted — the format (video, image, carousel), problems that stop it (a platform that takes no images, too many files, a missing Pinterest boardId, a channel to reconnect), warnings (a horizontal video for Reels), and the caption and metadata the post would carry. Each channel gets the item's caption, its shared metadata fields that platform knows, its title and description where the platform has them, then that platform's overrides. Schedules nothing.",
    inputSchema: object({ id: ITEM_ID, ...TARGET }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) => schedule.planItem(userId, input.string("id"), target(input)),
  },
  {
    name: "schedule_item",
    scope: "publish",
    description:
      "Schedule a library item to brands and/or channels: one post per channel that can take it (see plan_item), all at scheduledAt, each linked to the item. Channels that cannot take it are skipped with their reasons; answers { scheduled: [{ accountId, postId }], skipped, failed }. The posts then behave like any from create_post — editable and cancellable until they go out.",
    inputSchema: object(
      {
        id: ITEM_ID,
        ...TARGET,
        scheduledAt: {
          type: "string",
          description: "ISO 8601 with timezone offset. Omit to post now (live after each lead).",
        },
        leadMinutes: {
          type: "number",
          description: "Same for every channel; omit to keep each platform's default",
        },
      },
      ["id"],
    ),
    run: (userId, input) =>
      schedule.scheduleItem(userId, input.string("id"), target(input), {
        scheduledAt: input.optionalString("scheduledAt"),
        leadMinutes: input.number("leadMinutes"),
      }),
  },
];
