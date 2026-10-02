import { object } from "#/modules/api/input";
import { READ_ONLY, type Tool } from "#/modules/api/tool";
import * as groups from "./groups.service";
import * as publishing from "./publish.service";
import {
  groupChanges,
  groupFilter,
  groupInput,
  publishOptions,
  selection,
  target,
} from "./library.args";
import {
  GROUP_FIELDS,
  GROUP_FILTERS,
  PUBLISH_OPTIONS,
  SELECTION_FIELDS,
  TARGET,
} from "./library.schemas";

/**
 * The library for agents: groups — files that go out together, with the words drafted for
 * them — ready for the person to publish from the workspace in a few clicks, or for the
 * agent to publish itself (plan_group, publish_group). Field schemas are shared with the
 * REST API (library.schemas.ts).
 */

const GROUP_ID = { type: "string", description: "Group id (list_groups)" };

export const libraryTools: Tool[] = [
  {
    name: "create_group",
    scope: "library",
    description:
      "Make a group in the library: files that go out together (a carousel), with the title, caption and metadata you drafted, so the user can publish it from the workspace in a few clicks. Empty is fine — then upload into it with create_upload or import_file (groupId). Answers the group with its files (kind, size, orientation, duration).",
    inputSchema: object(GROUP_FIELDS),
    run: (userId, input) => groups.createGroup(userId, groupInput(input), "agent"),
  },
  {
    name: "update_group",
    scope: "library",
    description:
      "Change a group: the given fields only (null clears one); fileIds, when given, replaces its files and their order (the ones left out stay in storage); metadata is merged.",
    inputSchema: object({ id: GROUP_ID, ...GROUP_FIELDS }, ["id"]),
    run: (userId, input) => groups.updateGroup(userId, input.string("id"), groupChanges(input)),
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
    inputSchema: object(GROUP_FILTERS),
    annotations: READ_ONLY,
    run: (userId, input) => groups.listGroups(userId, groupFilter(input)),
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
    idempotent: true,
    scope: "publish",
    description:
      "Publish a group to brands and/or channels: one post per channel that can take it (see plan_group), all at scheduledAt. Channels that cannot are skipped with their reasons; answers { scheduled: [{ accountId, postId }], skipped, failed }. The posts behave like any from create_post — editable and cancellable until they go out. Once every post is out (or cancelled), the files are deleted from storage, and the emptied group with them.",
    inputSchema: object({ id: GROUP_ID, ...TARGET, ...PUBLISH_OPTIONS }, ["id"]),
    run: async (userId, input) =>
      publishing.publishPost(
        userId,
        await publishing.groupSource(userId, input.string("id")),
        target(input),
        publishOptions(input),
      ),
  },
  {
    name: "plan_files",
    scope: "library",
    description:
      "Like plan_group, for files that are not in a group: for each channel of the given brands and channels, whether these files can go there as one post and as what, what stops it, what is not ideal, and the caption and metadata the post would carry. Publishes nothing.",
    inputSchema: object({ ...SELECTION_FIELDS, ...TARGET }, ["fileIds"]),
    annotations: READ_ONLY,
    run: async (userId, input) => {
      const { fileIds, draft } = selection(input);
      return publishing.planPost(
        userId,
        await publishing.filesSource(userId, fileIds, draft),
        target(input),
      );
    },
  },
  {
    name: "publish_files",
    idempotent: true,
    scope: "publish",
    description:
      "Like publish_group, for files that are not in a group: one post per channel that can take them (see plan_files), all at scheduledAt; the others are skipped with their reasons. Answers { scheduled: [{ accountId, postId }], skipped, failed }. Once every post is out (or cancelled), the files are deleted from storage.",
    inputSchema: object({ ...SELECTION_FIELDS, ...TARGET, ...PUBLISH_OPTIONS }, ["fileIds"]),
    run: async (userId, input) => {
      const { fileIds, draft } = selection(input);
      return publishing.publishPost(
        userId,
        await publishing.filesSource(userId, fileIds, draft),
        target(input),
        publishOptions(input),
      );
    },
  },
];
