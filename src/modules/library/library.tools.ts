import { object, READ_ONLY, type Tool } from "#/modules/api/tool";
import * as groups from "./groups.service";
import * as publishing from "./publish.service";

/**
 * The library for agents: groups — files that go out together, with the words drafted for
 * them — ready for the person to publish from the workspace in a few clicks, or for the
 * agent to publish itself (plan_group, publish_group).
 */

const GROUP_ID = { type: "string", description: "Group id (list_groups)" };
const FIELDS = {
  title: { type: "string", description: "Title where the platform has one (YouTube, Pinterest)" },
  caption: { type: "string", description: "The post text; the default on every platform" },
  description: { type: "string", description: "Longer description where the platform has one" },
  fileIds: {
    type: "array",
    items: { type: "string" },
    description:
      "Files from storage (list_files ids), in order — a carousel's order. Each must be ready (finish_upload done); a file in another group moves here. To upload straight into a group, pass groupId to create_upload or import_file instead.",
  },
  metadata: {
    type: "object",
    description:
      "Fields every platform shares (tags, thumbnailUrl, firstComment, …) and platforms: { youtube: { … }, instagram: { … } } with each platform's overrides (same fields as create_post's metadata for that platform; a caption there replaces the caption on that platform). On update it is merged; null clears a field or a platform.",
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
    name: "create_group",
    scope: "library",
    description:
      "Make a group in the library: files that go out together (a carousel), with the title, caption and metadata you drafted, so the user can publish it from the workspace in a few clicks. Empty is fine — then upload into it with create_upload or import_file (groupId). Answers the group with its files (kind, size, orientation, duration).",
    inputSchema: object(FIELDS),
    run: (userId, input) =>
      groups.createGroup(
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
    name: "update_group",
    scope: "library",
    description:
      "Change a group: the given fields only (null clears one); fileIds, when given, replaces its files and their order (the ones left out stay in storage); metadata is merged.",
    inputSchema: object({ id: GROUP_ID, ...FIELDS }, ["id"]),
    run: (userId, input) => {
      const text = (name: string) => (input.raw(name) === null ? null : input.optionalString(name));
      return groups.updateGroup(userId, input.string("id"), {
        title: text("title"),
        caption: text("caption"),
        description: text("description"),
        fileIds: input.strings("fileIds"),
        metadata: input.raw("metadata") === null ? null : input.object("metadata"),
      });
    },
  },
  {
    name: "get_group",
    scope: "library",
    description:
      "One group: its files in order, its drafted words, and the posts published from it.",
    inputSchema: object({ id: GROUP_ID }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) => groups.getGroup(userId, input.string("id")),
  },
  {
    name: "list_groups",
    scope: "library",
    description:
      "List the library's groups, newest first, with their files — narrowed by words in the title, caption or description. Returns { groups, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object({
      search: { type: "string", description: "Words in the title, caption or description" },
      limit: { type: "number", description: "Groups per page: default 50, max 200" },
      cursor: { type: "string", description: "nextCursor from the previous page" },
    }),
    annotations: READ_ONLY,
    run: (userId, input) =>
      groups.listGroups(userId, {
        search: input.optionalString("search"),
        limit: input.number("limit"),
        cursor: input.optionalString("cursor"),
      }),
  },
  {
    name: "delete_group",
    scope: "library",
    description:
      "Delete a group. Its files stay in storage, in no group — unless deleteFiles, which deletes them too (except any a post not yet sent still needs).",
    inputSchema: object(
      { id: GROUP_ID, deleteFiles: { type: "boolean", description: "Delete its files too" } },
      ["id"],
    ),
    annotations: { destructiveHint: true },
    run: (userId, input) =>
      groups.deleteGroup(userId, input.string("id"), {
        deleteFiles: input.raw("deleteFiles") === true,
      }),
  },
  {
    name: "plan_group",
    scope: "library",
    description:
      "Before publishing a group: for each channel of the given brands and channels, whether its files can go there and as what (label: Short, Video, Reel, Photo, Carousel, Album, Pin…), problems that stop it (a platform that takes no images, too many files, a missing YouTube title or Pinterest boardId, a channel to reconnect), warnings (a horizontal video for Reels), and the caption and metadata the post would carry. Publishes nothing.",
    inputSchema: object({ id: GROUP_ID, ...TARGET }, ["id"]),
    annotations: READ_ONLY,
    run: async (userId, input) =>
      publishing.planPost(
        userId,
        await publishing.groupSource(userId, input.string("id")),
        target(input),
      ),
  },
  {
    name: "publish_group",
    scope: "publish",
    description:
      "Publish a group to brands and/or channels: one post per channel that can take it (see plan_group), all at scheduledAt. Channels that cannot are skipped with their reasons; answers { scheduled: [{ accountId, postId }], skipped, failed }. The posts behave like any from create_post — editable and cancellable until they go out. Once every post is out, the files are deleted from storage (and the emptied group), unless keepFiles.",
    inputSchema: object(
      {
        id: GROUP_ID,
        ...TARGET,
        scheduledAt: {
          type: "string",
          description: "ISO 8601 with timezone offset. Omit to post now (live after each lead).",
        },
        leadMinutes: {
          type: "number",
          description: "Same for every channel; omit to keep each platform's default",
        },
        keepFiles: {
          type: "boolean",
          description: "Keep the files in storage after the posts are out (default: delete them)",
        },
      },
      ["id"],
    ),
    run: async (userId, input) =>
      publishing.publishPost(
        userId,
        await publishing.groupSource(userId, input.string("id")),
        target(input),
        {
          scheduledAt: input.optionalString("scheduledAt"),
          leadMinutes: input.number("leadMinutes"),
          keepFiles: input.raw("keepFiles") === true,
        },
      ),
  },
];
