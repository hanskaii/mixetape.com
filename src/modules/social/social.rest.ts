import { ServiceError } from "#/modules/api/errors";
import { object } from "#/modules/api/input";
import type { Endpoint } from "#/modules/api/rest";
import * as analytics from "./analytics.service";
import * as brands from "./brands.service";
import * as platform from "./platform.service";
import * as social from "./social.service";
import { postChanges, postFilter, postInput } from "./social.args";
import {
  ACCOUNT,
  ACCOUNT_ANALYTICS,
  BRAND,
  BRAND_FIELDS,
  CAPTION,
  CAPTION_FIELDS,
  COLLECTION,
  COLLECTION_FIELDS,
  COMMENT,
  COMMENT_FILTERS,
  CONNECT_RESULT,
  CONNECT_STARTED,
  LIVE_METADATA,
  MODERATION,
  PLATFORMS,
  PLATFORM_STATUS,
  POST,
  POST_ANALYTICS,
  POST_FIELDS,
  POST_FILTERS,
  RANGE,
} from "./social.schemas";

/** Accounts, connections, brands and posts as REST resources. */

const list = (name: string, items: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  object({ [name]: { type: "array", items }, ...extra }, [name, ...Object.keys(extra)]);
const one = (name: string, schema: Record<string, unknown>) => object({ [name]: schema }, [name]);
const PAGE_CURSOR = {
  nextCursor: { type: ["string", "null"], description: "Pass as cursor for the next page" },
};
const DELETED = object({ deleted: { type: "boolean", const: true }, id: { type: "string" } }, [
  "deleted",
  "id",
]);

const POST_ID = { id: "The post's id" };
const COMMENT_ID = { ...POST_ID, commentId: "The comment's id, from the post's comments" };

const postOut = async (pending: Promise<Parameters<typeof social.postView>[0]>) => ({
  post: social.postView(await pending),
});

const accounts: Endpoint[] = [
  {
    method: "GET",
    path: "/accounts",
    operationId: "listAccounts",
    tag: "Accounts",
    scope: "read",
    summary: "List connected accounts",
    description:
      "The connected channels, with their status and what each platform takes in one post. An account with status reconnect must be connected again before posting to it.",
    response: { description: "The accounts.", schema: list("accounts", ACCOUNT) },
    run: async (userId) => ({
      accounts: (await social.listAccounts(userId)).map(social.accountView),
    }),
  },
  {
    method: "DELETE",
    path: "/accounts/{id}",
    operationId: "disconnectAccount",
    tag: "Accounts",
    scope: "channels",
    params: { id: "The account's id" },
    summary: "Disconnect an account",
    description:
      "Removes the channel from mixetape, with its posts and their history; nothing changes on the platform. An account with posts still waiting to go out is refused (409) until they are cancelled.",
    response: { description: "Disconnected.", schema: DELETED },
    errors: [404, 409, 502],
    run: (userId, input) => social.disconnectAccount(userId, input.string("id")),
  },
  {
    method: "GET",
    path: "/accounts/{id}/collections",
    operationId: "listCollections",
    needs: "collections",
    tag: "Accounts",
    scope: "read",
    params: { id: "The account's id" },
    summary: "List an account's collections",
    description:
      "Playlists on YouTube, boards on Pinterest — with id, title, visibility and item count. A collection id goes in a post's metadata (playlistIds, boardId).",
    response: { description: "The collections.", schema: list("collections", COLLECTION) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      collections: await platform.listCollections(userId, input.string("id")),
    }),
  },
  {
    method: "POST",
    path: "/accounts/{id}/collections",
    operationId: "createCollection",
    needs: "collections",
    tag: "Accounts",
    scope: "manage",
    params: { id: "The account's id" },
    summary: "Create a collection",
    description: "Create a YouTube playlist or a Pinterest board on the account.",
    body: object(COLLECTION_FIELDS, ["title"]),
    status: 201,
    response: { description: "The new collection.", schema: one("collection", COLLECTION) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      collection: await platform.createCollection(userId, input.string("id"), {
        title: input.string("title"),
        description: input.optionalString("description"),
        visibility: input.optionalString("visibility"),
      }),
    }),
  },
  {
    method: "GET",
    path: "/accounts/{id}/analytics",
    operationId: "getAccountAnalytics",
    needs: "accountAnalytics",
    tag: "Accounts",
    scope: "analytics",
    params: { id: "The account's id" },
    query: RANGE,
    summary: "Get an account's analytics",
    description:
      "Totals, day by day where the platform reports them, the top 10 posts and traffic sources. Defaults to the last 28 days; the last few days are incomplete (dataDelayDays).",
    response: { description: "The account's analytics.", schema: ACCOUNT_ANALYTICS },
    errors: [404, 409, 502],
    run: (userId, input) =>
      analytics.accountAnalytics(userId, input.string("id"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
];

const connections: Endpoint[] = [
  {
    method: "POST",
    path: "/connections",
    operationId: "startConnection",
    tag: "Connections",
    scope: "channels",
    summary: "Start connecting an account",
    description:
      "Returns the platform's sign-in page for the person who owns the account. Nothing is connected until they sign in and allow access; follow the attempt with its state. The link works once, for 10 minutes.",
    body: object(
      {
        platform: { type: "string", enum: PLATFORMS },
        account: {
          type: "string",
          description:
            "Who is connecting, where the platform needs it: the Mastodon account (@you@mastodon.social — its server is what counts), or a Bluesky handle (optional)",
        },
      },
      ["platform"],
    ),
    status: 201,
    response: {
      description: "The sign-in link and the state that follows it.",
      schema: CONNECT_STARTED,
    },
    errors: [503],
    run: async (userId, input) => {
      const started = await social.beginConnect(
        userId,
        input.string("platform"),
        "agent",
        input.optionalString("account"),
      );
      return { url: started.url, state: started.state, expiresAt: started.expiresAt };
    },
  },
  {
    method: "GET",
    path: "/connections/{state}",
    operationId: "getConnection",
    tag: "Connections",
    scope: "channels",
    params: { state: "The state the connection started with" },
    summary: "Follow a connection",
    description:
      "Where the attempt stands: pending until the person finishes; done with the accounts connected; choose when the sign-in reached several new accounts (e.g. Facebook Pages) to pick from; error with why.",
    response: { description: "The attempt.", schema: CONNECT_RESULT },
    run: (userId, input) => social.connectResult(userId, input.string("state")),
  },
  {
    method: "POST",
    path: "/connections/{state}/accounts",
    operationId: "chooseAccounts",
    tag: "Connections",
    scope: "channels",
    params: { state: "The state the connection started with" },
    summary: "Choose the accounts to add",
    description:
      "After a connection answered choose: add the picked accounts. The choice is held for 10 minutes after the sign-in; the ones left out are not connected.",
    body: object(
      {
        platformAccountIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "platformAccountId of each chosen account, from the choices",
        },
      },
      ["platformAccountIds"],
    ),
    response: {
      description: "The names of the accounts connected.",
      schema: list("channels", { type: "string" }),
    },
    errors: [410],
    run: (userId, input) => {
      const ids = input.strings("platformAccountIds") ?? [];
      if (!ids.length) throw new ServiceError("Choose at least one account");
      return social.chooseChannels(userId, input.string("state"), ids);
    },
  },
];

const brandEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/brands",
    operationId: "listBrands",
    tag: "Brands",
    scope: "read",
    summary: "List brands",
    description: "The user's groups of connected accounts, each with its accountIds.",
    response: { description: "The brands.", schema: list("brands", BRAND) },
    run: async (userId) => ({ brands: await brands.listBrands(userId) }),
  },
  {
    method: "POST",
    path: "/brands",
    operationId: "createBrand",
    tag: "Brands",
    scope: "channels",
    summary: "Create a brand",
    description: "Group connected accounts as a brand, to publish to all of them at once.",
    body: object(BRAND_FIELDS, ["name"]),
    status: 201,
    response: { description: "The new brand.", schema: one("brand", BRAND) },
    run: async (userId, input) => ({
      brand: await brands.createBrand(userId, {
        name: input.string("name"),
        accountIds: input.strings("accountIds"),
      }),
    }),
  },
  {
    method: "PATCH",
    path: "/brands/{id}",
    operationId: "updateBrand",
    tag: "Brands",
    scope: "channels",
    params: { id: "The brand's id" },
    summary: "Change a brand",
    description: "Rename it and/or replace its accounts (accountIds replaces the whole list).",
    body: object(BRAND_FIELDS),
    response: { description: "The brand.", schema: one("brand", BRAND) },
    errors: [404],
    run: async (userId, input) => ({
      brand: await brands.updateBrand(userId, input.string("id"), {
        name: input.optionalString("name"),
        accountIds: input.strings("accountIds"),
      }),
    }),
  },
  {
    method: "DELETE",
    path: "/brands/{id}",
    operationId: "deleteBrand",
    tag: "Brands",
    scope: "channels",
    params: { id: "The brand's id" },
    summary: "Delete a brand",
    description: "Its accounts stay connected.",
    response: { description: "Deleted.", schema: DELETED },
    errors: [404],
    run: (userId, input) => brands.deleteBrand(userId, input.string("id")),
  },
];

const posts: Endpoint[] = [
  {
    method: "GET",
    path: "/posts",
    operationId: "listPosts",
    tag: "Posts",
    scope: "read",
    query: POST_FILTERS,
    summary: "List posts",
    description:
      "Newest scheduled time first, a page at a time — narrowed by account, platform, status, time or words in the title, caption or description. Pass nextCursor back as cursor, with the same filters, for the next page.",
    response: { description: "A page of posts.", schema: list("posts", POST, PAGE_CURSOR) },
    run: async (userId, input) => {
      const { posts, nextCursor } = await social.listPosts(userId, postFilter(input));
      return { posts: posts.map(social.postView), nextCursor };
    },
  },
  {
    method: "POST",
    path: "/posts",
    operationId: "createPost",
    idempotent: true,
    tag: "Posts",
    scope: "publish",
    summary: "Schedule a post",
    description:
      "The post waits in mixetape — editable and cancellable — until its lead before scheduledAt. YouTube and Facebook then take it unpublished and publish it themselves at scheduledAt; Instagram and Threads get it prepared and mixetape publishes it at scheduledAt; TikTok and Pinterest cannot hold a post, so mixetape posts it at scheduledAt. Each platform takes its own metadata (see Platforms); files in mixetape storage are checked against what the platform takes before the post is accepted.",
    body: object({ accountId: { type: "string" }, ...POST_FIELDS }, ["accountId"]),
    status: 201,
    response: { description: "The scheduled post.", schema: one("post", POST) },
    errors: [404, 409],
    run: (userId, input) =>
      postOut(
        social.createPost(userId, { accountId: input.string("accountId"), ...postInput(input) }),
      ),
  },
  {
    method: "GET",
    path: "/posts/{id}",
    operationId: "getPost",
    tag: "Posts",
    scope: "read",
    params: POST_ID,
    summary: "Get a post",
    description: "The post with its status, error, platform link and attempts.",
    response: { description: "The post.", schema: one("post", POST) },
    errors: [404],
    run: (userId, input) => postOut(social.getPost(userId, input.string("id"))),
  },
  {
    method: "PATCH",
    path: "/posts/{id}",
    operationId: "updatePost",
    tag: "Posts",
    scope: "publish",
    params: POST_ID,
    summary: "Change a scheduled post",
    description:
      "Its time, lead, files, caption or metadata, while it still waits in mixetape (status scheduled). Metadata is merged; null clears a field. Once it is on the platform, change it there with PATCH /posts/{id}/platform.",
    body: object(POST_FIELDS),
    response: { description: "The changed post.", schema: one("post", POST) },
    errors: [404, 409, 502],
    run: (userId, input) =>
      postOut(social.editPost(userId, input.string("id"), postChanges(input))),
  },
  {
    method: "POST",
    path: "/posts/{id}/cancel",
    operationId: "cancelPost",
    tag: "Posts",
    scope: "publish",
    params: POST_ID,
    summary: "Cancel a scheduled post",
    description:
      "Stops a post that still waits in mixetape; it stays listed as cancelled. Cancelling it again answers 409 invalid_post_state.",
    response: { description: "The cancelled post.", schema: one("post", POST) },
    errors: [404, 409],
    run: (userId, input) => postOut(social.cancelPost(userId, input.string("id"))),
  },
  {
    method: "DELETE",
    path: "/posts/{id}",
    operationId: "deletePost",
    deprecated: true,
    tag: "Posts",
    scope: "publish",
    params: POST_ID,
    summary: "Cancel a scheduled post (old path)",
    description:
      "The same as POST /posts/{id}/cancel, kept for scripts written before it. The post is cancelled, not deleted: it stays listed as cancelled.",
    response: { description: "The cancelled post.", schema: one("post", POST) },
    errors: [404, 409],
    run: (userId, input) => postOut(social.cancelPost(userId, input.string("id"))),
  },
  {
    method: "POST",
    path: "/posts/{id}/retry",
    operationId: "retryPost",
    tag: "Posts",
    scope: "publish",
    params: POST_ID,
    summary: "Retry a failed post",
    description: "Sends it again — now, or at its original time if that is still ahead.",
    response: { description: "The post, scheduled again.", schema: one("post", POST) },
    errors: [404, 409],
    run: (userId, input) => postOut(social.retryPost(userId, input.string("id"))),
  },
  {
    method: "GET",
    path: "/posts/{id}/platform",
    operationId: "getPostOnPlatform",
    needs: "status",
    tag: "Posts",
    scope: "read",
    params: POST_ID,
    summary: "Get a post as the platform has it",
    description:
      "What the platform says now: visibility, processing, the publish time it holds, any rejection, and lifetime views, likes and comments. platform is null before the post is on the platform.",
    response: {
      description: "The post and the platform's view of it.",
      schema: object({ post: POST, platform: { ...PLATFORM_STATUS, type: ["object", "null"] } }, [
        "post",
        "platform",
      ]),
    },
    errors: [404, 409, 502],
    run: async (userId, input) => {
      const found = await platform.postInsights(userId, input.string("id"));
      return { post: social.postView(found.post), platform: found.platform };
    },
  },
  {
    method: "PATCH",
    path: "/posts/{id}/platform",
    operationId: "editPostOnPlatform",
    needs: "editing",
    tag: "Posts",
    scope: "manage",
    params: POST_ID,
    summary: "Change a post on the platform",
    description:
      "Changes the details of a post already on the platform (uploaded or published). YouTube: title, description, tags, category, privacy, made-for-kids, language and localizations. Facebook: title and description. Only the given fields change; null clears one.",
    body: object({ metadata: LIVE_METADATA }, ["metadata"]),
    response: { description: "The post.", schema: one("post", POST) },
    errors: [404, 409, 502],
    run: (userId, input) =>
      postOut(
        platform.editPublishedPost(userId, input.string("id"), input.object("metadata") ?? {}),
      ),
  },
  {
    method: "PUT",
    path: "/posts/{id}/thumbnail",
    operationId: "setThumbnail",
    needs: "thumbnails",
    tag: "Posts",
    scope: "publish",
    params: POST_ID,
    summary: "Set a post's thumbnail",
    description:
      "Sets or replaces the custom thumbnail of a post already on the platform, from a public https JPEG or PNG (YouTube: up to 2 MB, 1280×720, verified channel). A post still scheduled takes metadata.thumbnailUrl instead.",
    body: object({ imageUrl: { type: "string" } }, ["imageUrl"]),
    response: { description: "The post.", schema: one("post", POST) },
    errors: [404, 409, 502],
    run: (userId, input) =>
      postOut(platform.setPostThumbnail(userId, input.string("id"), input.string("imageUrl"))),
  },
  {
    method: "POST",
    path: "/posts/{id}/collections",
    operationId: "addToCollection",
    needs: "collections",
    tag: "Posts",
    scope: "manage",
    params: POST_ID,
    summary: "Add a post to a collection",
    description:
      "Adds a post that is on the platform to a YouTube playlist, or saves a Pin to another Pinterest board. position 0 puts it first; left out, it goes last.",
    body: object({ collectionId: { type: "string" }, position: { type: "integer", minimum: 0 } }, [
      "collectionId",
    ]),
    response: {
      description: "Added.",
      schema: object(
        {
          added: { type: "boolean" },
          collectionId: { type: "string" },
          postId: { type: "string" },
        },
        ["added", "collectionId", "postId"],
      ),
    },
    errors: [404, 409, 502],
    run: (userId, input) =>
      platform.addToCollection(
        userId,
        input.string("id"),
        input.string("collectionId"),
        input.number("position"),
      ),
  },
  {
    method: "GET",
    path: "/posts/{id}/captions",
    operationId: "listCaptions",
    needs: "captions",
    tag: "Posts",
    scope: "read",
    params: POST_ID,
    summary: "List a post's captions",
    description:
      "The caption tracks of a post on the platform; kind asr is generated automatically.",
    response: { description: "The tracks.", schema: list("captions", CAPTION) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      captions: await platform.listCaptions(userId, input.string("id")),
    }),
  },
  {
    method: "PUT",
    path: "/posts/{id}/captions",
    operationId: "putCaption",
    needs: "captions",
    tag: "Posts",
    scope: "manage",
    params: POST_ID,
    summary: "Upload a caption track",
    description:
      "Uploads a subtitle track to a post on the platform: SRT or WebVTT on YouTube, SRT on Facebook. A track with the same language and name is replaced.",
    body: object(CAPTION_FIELDS, ["language", "url"]),
    response: {
      description: "The track.",
      schema: one("caption", {
        ...CAPTION,
        properties: { ...CAPTION.properties, replaced: { type: "boolean" } },
      }),
    },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      caption: await platform.putCaption(userId, input.string("id"), {
        language: input.string("language"),
        name: input.optionalString("name"),
        url: input.string("url"),
        isDraft: input.boolean("isDraft"),
      }),
    }),
  },
  {
    method: "GET",
    path: "/posts/{id}/comments",
    operationId: "listComments",
    needs: "comments",
    tag: "Comments",
    scope: "comments",
    params: POST_ID,
    query: COMMENT_FILTERS,
    summary: "List a post's comments",
    description: "The comments on a post, with their replies; held lists those held for review.",
    response: { description: "The comments.", schema: list("comments", COMMENT) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      comments: await platform.listComments(userId, input.string("id"), {
        limit: input.number("limit"),
        order: input.optionalString("order"),
        held: input.boolean("held"),
      }),
    }),
  },
  {
    method: "POST",
    path: "/posts/{id}/comments",
    operationId: "postComment",
    needs: "comments",
    tag: "Comments",
    scope: "comments",
    params: POST_ID,
    summary: "Comment on a post",
    description:
      "Posts a comment on a public post as the account itself — e.g. a link to the full video under a Short. Neither platform lets an API pin it.",
    body: object({ text: { type: "string" } }, ["text"]),
    status: 201,
    response: { description: "The comment.", schema: one("comment", COMMENT) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      comment: await platform.postComment(userId, input.string("id"), input.string("text")),
    }),
  },
  {
    method: "POST",
    path: "/posts/{id}/comments/{commentId}/replies",
    operationId: "replyToComment",
    needs: "comments",
    tag: "Comments",
    scope: "comments",
    params: COMMENT_ID,
    summary: "Reply to a comment",
    description: "Replies to a comment on one of the account's posts, as the account.",
    body: object({ text: { type: "string" } }, ["text"]),
    status: 201,
    response: { description: "The reply.", schema: one("comment", COMMENT) },
    errors: [404, 409, 502],
    run: async (userId, input) => ({
      comment: await platform.replyToComment(
        userId,
        input.string("id"),
        input.string("commentId"),
        input.string("text"),
      ),
    }),
  },
  {
    method: "PATCH",
    path: "/posts/{id}/comments/{commentId}",
    operationId: "moderateComment",
    needs: "comments",
    tag: "Comments",
    scope: "comments",
    params: COMMENT_ID,
    summary: "Moderate a comment",
    description:
      "Publishes it, holds it for review, or rejects (hides) it. banAuthor with rejected also hides the author's future comments.",
    body: object(MODERATION, ["status"]),
    response: {
      description: "The comment's new status.",
      schema: object(
        {
          commentId: { type: "string" },
          status: MODERATION.status,
          bannedAuthor: { type: "boolean" },
        },
        ["commentId", "status", "bannedAuthor"],
      ),
    },
    errors: [404, 409, 502],
    run: (userId, input) =>
      platform.moderateComment(
        userId,
        input.string("id"),
        input.string("commentId"),
        input.string("status"),
        input.boolean("banAuthor"),
      ),
  },
  {
    method: "GET",
    path: "/posts/{id}/analytics",
    operationId: "getPostAnalytics",
    needs: "analytics",
    tag: "Posts",
    scope: "analytics",
    params: POST_ID,
    query: RANGE,
    summary: "Get a post's analytics",
    description:
      "Views, watch time, average view duration and percentage, likes, comments, shares, subscribers gained and lost, the audience-retention curve and traffic sources — whichever the platform reports. Defaults to the day it went up through today.",
    response: { description: "The post's analytics.", schema: POST_ANALYTICS },
    errors: [404, 409, 502],
    run: (userId, input) =>
      analytics.postAnalytics(userId, input.string("id"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
];

export const socialEndpoints: Endpoint[] = [
  ...accounts,
  ...connections,
  ...brandEndpoints,
  ...posts,
];
