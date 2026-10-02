import { object } from "#/modules/api/input";
import type { Endpoint } from "#/modules/api/rest";
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
  GROUP,
  GROUP_FIELDS,
  GROUP_FILTERS,
  PLAN,
  PUBLISHED,
  PUBLISH_OPTIONS,
  SELECTION_FIELDS,
  TARGET,
} from "./library.schemas";

/**
 * Library groups as REST resources: files that go out together, with the words drafted for
 * them, published to brands and accounts in one call.
 */

const GROUP_ID = { id: "The group's id" };
const ONE_GROUP = object({ group: GROUP }, ["group"]);

export const libraryEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/groups",
    operationId: "listGroups",
    tag: "Groups",
    scope: "library",
    query: GROUP_FILTERS,
    summary: "List groups",
    description:
      "Newest first, with their files — narrowed by words in the title, caption or description. Pass nextCursor back as cursor for the next page.",
    response: {
      description: "A page of groups.",
      schema: object(
        {
          groups: { type: "array", items: GROUP },
          nextCursor: { type: ["string", "null"], description: "Pass as cursor for the next page" },
        },
        ["groups", "nextCursor"],
      ),
    },
    run: (userId, input) => groups.listGroups(userId, groupFilter(input)),
  },
  {
    method: "POST",
    path: "/groups",
    operationId: "createGroup",
    tag: "Groups",
    scope: "library",
    summary: "Create a group",
    description:
      "Files that go out together (a carousel), with the title, caption and metadata drafted for them. Empty is fine: upload or import into it with groupId.",
    body: object(GROUP_FIELDS),
    status: 201,
    response: { description: "The new group.", schema: ONE_GROUP },
    errors: [404, 409],
    run: async (userId, input) => ({
      group: await groups.createGroup(userId, groupInput(input), "agent"),
    }),
  },
  {
    method: "GET",
    path: "/groups/{id}",
    operationId: "getGroup",
    tag: "Groups",
    scope: "library",
    params: GROUP_ID,
    summary: "Get a group",
    description: "Its files in order, its drafted words, and the posts published from it.",
    response: { description: "The group.", schema: ONE_GROUP },
    errors: [404],
    run: async (userId, input) => ({ group: await groups.getGroup(userId, input.string("id")) }),
  },
  {
    method: "PATCH",
    path: "/groups/{id}",
    operationId: "updateGroup",
    tag: "Groups",
    scope: "library",
    params: GROUP_ID,
    summary: "Change a group",
    description:
      "The given fields only (null clears one). fileIds replaces its files and their order; metadata is merged.",
    body: object(GROUP_FIELDS),
    response: { description: "The group.", schema: ONE_GROUP },
    errors: [404, 409],
    run: async (userId, input) => ({
      group: await groups.updateGroup(userId, input.string("id"), groupChanges(input)),
    }),
  },
  {
    method: "DELETE",
    path: "/groups/{id}",
    operationId: "deleteGroup",
    tag: "Groups",
    scope: "library",
    params: GROUP_ID,
    query: { deleteFiles: { type: "boolean", description: "Delete its files too" } },
    summary: "Delete a group",
    description:
      "Its files stay in storage, in no group — unless deleteFiles, which deletes them too (except any a post not yet sent still needs, listed as kept).",
    response: {
      description: "Deleted.",
      schema: object(
        {
          deleted: { type: "boolean" },
          id: { type: "string" },
          kept: { type: "array", items: { type: "string" }, description: "Files still needed" },
        },
        ["deleted", "id"],
      ),
    },
    errors: [404],
    run: (userId, input) =>
      groups.deleteGroup(userId, input.string("id"), {
        deleteFiles: input.raw("deleteFiles") === true,
      }),
  },
  {
    method: "GET",
    path: "/groups/{id}/plan",
    operationId: "planGroup",
    tag: "Groups",
    scope: "library",
    params: GROUP_ID,
    query: TARGET,
    summary: "Plan publishing a group",
    description:
      "For each account of the given brands and accounts: whether the group can go there and as what (Short, Reel, Carousel, Album, Pin…), what stops it, what is not ideal, and the caption and metadata the post would carry. Publishes nothing.",
    response: { description: "The plan, account by account.", schema: PLAN },
    errors: [404, 409],
    run: async (userId, input) =>
      publishing.planPost(
        userId,
        await publishing.groupSource(userId, input.string("id")),
        target(input),
      ),
  },
  {
    method: "POST",
    path: "/groups/{id}/publish",
    operationId: "publishGroup",
    idempotent: true,
    tag: "Groups",
    scope: "publish",
    params: GROUP_ID,
    summary: "Publish a group",
    description:
      "One post per account that can take it, all at scheduledAt; the others are skipped with their reasons. The posts behave like any other — editable and cancellable until they go out. Once every post is out (or cancelled), the files are deleted from storage, and the emptied group with them.",
    body: object({ ...TARGET, ...PUBLISH_OPTIONS }),
    status: 201,
    response: { description: "What was scheduled, skipped and failed.", schema: PUBLISHED },
    errors: [404, 409],
    run: async (userId, input) =>
      publishing.publishPost(
        userId,
        await publishing.groupSource(userId, input.string("id")),
        target(input),
        publishOptions(input),
      ),
  },
  {
    method: "POST",
    path: "/files/plan",
    operationId: "planFiles",
    tag: "Files",
    scope: "library",
    summary: "Plan publishing files",
    description:
      "Like planning a group, for files that are not in one: for each account of the given brands and accounts, whether these files can go there as one post and as what, what stops it, what is not ideal, and the caption and metadata the post would carry. Publishes nothing.",
    body: object({ ...SELECTION_FIELDS, ...TARGET }, ["fileIds"]),
    response: { description: "The plan, account by account.", schema: PLAN },
    errors: [404, 409],
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
    method: "POST",
    path: "/files/publish",
    operationId: "publishFiles",
    idempotent: true,
    tag: "Files",
    scope: "publish",
    summary: "Publish files",
    description:
      "Like publishing a group, for files that are not in one: one post per account that can take them, all at scheduledAt; the others are skipped with their reasons. Once every post is out (or cancelled), the files are deleted from storage.",
    body: object({ ...SELECTION_FIELDS, ...TARGET, ...PUBLISH_OPTIONS }, ["fileIds"]),
    status: 201,
    response: { description: "What was scheduled, skipped and failed.", schema: PUBLISHED },
    errors: [404, 409],
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
