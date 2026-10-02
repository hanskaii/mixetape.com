import { ServiceError } from "#/modules/api/errors";
import { object } from "#/modules/api/input";
import { READ_ONLY, type Tool } from "#/modules/api/tool";
import * as analytics from "./analytics.service";
import * as platform from "./platform.service";
import * as social from "./social.service";
import * as brands from "./brands.service";
import { postChanges, postFilter, postInput } from "./social.args";
import {
  BRAND_FIELDS,
  CAPTION_FIELDS,
  COLLECTION_FIELDS,
  COMMENT_FILTERS,
  LIVE_METADATA,
  MODERATION,
  PLATFORMS,
  POST_FIELDS,
  POST_FILTERS,
  RANGE,
} from "./social.schemas";

/**
 * Accounts, posts, brands and connecting, as MCP tools for agents. Field schemas are shared
 * with the REST API (social.schemas.ts); the descriptions here tell an agent which tool comes
 * next.
 */

const id = (description: string) => ({ type: "string", description });
const POST_ID = id("mixetape post id (list_posts)");
const ACCOUNT_ID = id("mixetape account id (list_accounts)");
const STATE = id("The state connect_channel returned");

const post = async (pending: Promise<Parameters<typeof social.postView>[0]>) =>
  social.postView(await pending);

// ── tools ────────────────────────────────────────────────────────────────────

/** Scheduling and managing posts on connected accounts. */
export const socialTools: Tool[] = [
  // read
  {
    name: "list_accounts",
    scope: "read",
    description:
      "List the connected channels: id, platform, name, handle, status, the capabilities its platform supports (e.g. comments, analytics), and formats: what one post can hold there (video, image, a carousel of min–max files, image types, video length, upright). status 'reconnect' means the channel must be connected again (connect_channel, or /channels) — also after mixetape asks for new permissions.",
    inputSchema: object({}),
    annotations: READ_ONLY,
    run: async (userId) => (await social.listAccounts(userId)).map(social.accountView),
  },
  {
    name: "list_posts",
    scope: "read",
    description:
      "List posts, newest scheduled time first, a page at a time — narrow by account, platform, status, time or words in the title/caption. Statuses: scheduled (waiting in mixetape, editable with update_post), publishing (uploading), uploaded (on the platform, private until its time), published (live; change with edit_published_post), failed, cancelled. Returns { posts, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object(POST_FILTERS),
    annotations: READ_ONLY,
    run: async (userId, input) => {
      const { posts, nextCursor } = await social.listPosts(userId, postFilter(input));
      return { posts: posts.map(social.postView), nextCursor };
    },
  },
  {
    name: "get_post",
    scope: "read",
    description: "One post with its status, error, platform link and attempts.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) => post(social.getPost(userId, input.string("id"))),
  },
  {
    name: "get_post_insights",
    scope: "read",
    needs: "status",
    description:
      "How a post that is on the platform stands right now: visibility, processing, scheduled publish time, any rejection, plus lifetime views, likes and comments. For watch time and retention use get_post_analytics.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ_ONLY,
    run: async (userId, input) => {
      const insights = await platform.postInsights(userId, input.string("id"));
      return { post: social.postView(insights.post), platform: insights.platform };
    },
  },
  {
    name: "list_collections",
    scope: "read",
    needs: "collections",
    description:
      "List the account's collections — playlists on YouTube, boards on Pinterest — with id, title, visibility and item count. Use an id in metadata.playlistIds (YouTube), metadata.boardId (Pinterest) or add_to_collection.",
    inputSchema: object({ accountId: ACCOUNT_ID }, ["accountId"]),
    annotations: READ_ONLY,
    run: (userId, input) => platform.listCollections(userId, input.string("accountId")),
  },
  {
    name: "list_captions",
    scope: "read",
    needs: "captions",
    description:
      "List the caption tracks of a post on the platform (language, name, kind; 'asr' is automatic).",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) => platform.listCaptions(userId, input.string("id")),
  },

  // publish
  {
    name: "create_post",
    idempotent: true,
    scope: "publish",
    description:
      "Schedule a video on a connected account (see list_accounts for each account's platform). The post waits in mixetape (editable, cancellable) until shortly before scheduledAt. YouTube and Facebook get it leadMinutes early, unpublished, and publish it themselves at scheduledAt; Instagram and Threads get it prepared leadMinutes early and mixetape publishes it at scheduledAt; TikTok and Pinterest cannot hold a post, so mixetape posts it at scheduledAt. Each platform takes its own metadata (Facebook format reel for a Reel, Pinterest boardId is required, TikTok privacyLevel). Thumbnail, playlists and captions are applied right after upload where the platform supports them; firstComment is posted once it is public. mediaUrl: a public https URL, or an r2:// URL from mixetape storage (create_upload / import_file). For several files in one post — a carousel on Instagram, Threads or Pinterest, a photo album on Facebook — pass media (a list of URLs, in order) instead of mediaUrl; list_accounts shows what each platform takes (formats). Files in mixetape storage are checked against it before the post is accepted.",
    inputSchema: object({ accountId: ACCOUNT_ID, ...POST_FIELDS }, ["accountId"]),
    run: (userId, input) =>
      post(
        social.createPost(userId, { accountId: input.string("accountId"), ...postInput(input) }),
      ),
  },
  {
    name: "update_post",
    scope: "publish",
    description:
      "Change a post that is still 'scheduled' (waiting in mixetape): its time, lead, media, caption or metadata (merged; null clears a field). Once it is on the platform, use edit_published_post.",
    inputSchema: object({ id: POST_ID, ...POST_FIELDS }, ["id"]),
    run: (userId, input) => post(social.editPost(userId, input.string("id"), postChanges(input))),
  },
  {
    name: "cancel_post",
    scope: "publish",
    description: "Cancel a post that is still 'scheduled'.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => post(social.cancelPost(userId, input.string("id"))),
  },
  {
    name: "retry_post",
    scope: "publish",
    description:
      "Send a 'failed' post again — now, or at its original time if that is still ahead.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    run: (userId, input) => post(social.retryPost(userId, input.string("id"))),
  },
  {
    name: "set_thumbnail",
    scope: "publish",
    needs: "thumbnails",
    description:
      "Set or replace the custom thumbnail of a post already on the platform. imageUrl: public https JPEG/PNG (YouTube: ≤ 2 MB, 1280×720, verified channel). For a post still 'scheduled', use update_post with metadata.thumbnailUrl.",
    inputSchema: object({ id: POST_ID, imageUrl: { type: "string" } }, ["id", "imageUrl"]),
    annotations: { idempotentHint: true },
    run: (userId, input) =>
      platform.setPostThumbnail(userId, input.string("id"), input.string("imageUrl")),
  },

  // manage
  {
    name: "edit_published_post",
    scope: "manage",
    needs: "editing",
    description:
      "Change the details of a post that is already on the platform (uploaded or published). YouTube: title, description, tags, category, privacy, made-for-kids, language and localizations (50 quota units). Facebook: title and description. Only the given fields change; null clears one.",
    inputSchema: object({ id: POST_ID, metadata: LIVE_METADATA }, ["id", "metadata"]),
    annotations: { idempotentHint: true },
    run: (userId, input) =>
      platform.editPublishedPost(userId, input.string("id"), input.object("metadata") ?? {}),
  },
  {
    name: "create_collection",
    scope: "manage",
    needs: "collections",
    description: "Create a collection on the account: a YouTube playlist or a Pinterest board.",
    inputSchema: object({ accountId: ACCOUNT_ID, ...COLLECTION_FIELDS }, ["accountId", "title"]),
    run: (userId, input) =>
      platform.createCollection(userId, input.string("accountId"), {
        title: input.string("title"),
        description: input.optionalString("description"),
        visibility: input.optionalString("visibility"),
      }),
  },
  {
    name: "add_to_collection",
    scope: "manage",
    needs: "collections",
    description:
      "Add a post that is on the platform to a collection (YouTube playlist, or save a Pin to another Pinterest board). position 0 puts it first; omitted puts it last. For a post still 'scheduled', set metadata.playlistIds instead.",
    inputSchema: object(
      { id: POST_ID, collectionId: { type: "string" }, position: { type: "number" } },
      ["id", "collectionId"],
    ),
    run: (userId, input) =>
      platform.addToCollection(
        userId,
        input.string("id"),
        input.string("collectionId"),
        input.number("position"),
      ),
  },
  {
    name: "upload_caption",
    scope: "manage",
    needs: "captions",
    description:
      "Upload a subtitle track to a post on the platform: public https SRT or WebVTT on YouTube (400–450 quota units), SRT on Facebook. A track with the same language (and name) is replaced.",
    inputSchema: object({ id: POST_ID, ...CAPTION_FIELDS }, ["id", "language", "url"]),
    annotations: { idempotentHint: true },
    run: (userId, input) =>
      platform.putCaption(userId, input.string("id"), {
        language: input.string("language"),
        name: input.optionalString("name"),
        url: input.string("url"),
        isDraft: input.boolean("isDraft"),
      }),
  },

  // comments
  {
    name: "list_comments",
    scope: "comments",
    needs: "comments",
    description:
      "Read the comments on a post (with replies). Comment ids are what reply_to_comment and moderate_comment take. held: true lists comments held for review.",
    inputSchema: object({ id: POST_ID, ...COMMENT_FILTERS }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) =>
      platform.listComments(userId, input.string("id"), {
        limit: input.number("limit"),
        order: input.optionalString("order"),
        held: input.boolean("held"),
      }),
  },
  {
    name: "post_comment",
    scope: "comments",
    needs: "comments",
    description:
      "Post a comment on a public post as the channel itself — e.g. from a Short, a link to the full video. Neither API can pin it; pin it on the platform.",
    inputSchema: object({ id: POST_ID, text: { type: "string" } }, ["id", "text"]),
    run: (userId, input) => platform.postComment(userId, input.string("id"), input.string("text")),
  },
  {
    name: "reply_to_comment",
    scope: "comments",
    needs: "comments",
    description: "Reply to a comment on one of the account's posts, as the channel.",
    inputSchema: object({ id: POST_ID, commentId: { type: "string" }, text: { type: "string" } }, [
      "id",
      "commentId",
      "text",
    ]),
    run: (userId, input) =>
      platform.replyToComment(
        userId,
        input.string("id"),
        input.string("commentId"),
        input.string("text"),
      ),
  },
  {
    name: "moderate_comment",
    scope: "comments",
    needs: "comments",
    description:
      "Publish, hold for review, or reject (hide) a comment on one of the account's posts. banAuthor with 'rejected' also hides the author's future comments.",
    inputSchema: object({ id: POST_ID, commentId: { type: "string" }, ...MODERATION }, [
      "id",
      "commentId",
      "status",
    ]),
    annotations: { destructiveHint: true },
    run: (userId, input) =>
      platform.moderateComment(
        userId,
        input.string("id"),
        input.string("commentId"),
        input.string("status"),
        input.boolean("banAuthor"),
      ),
  },

  // channels
  {
    name: "disconnect_channel",
    scope: "channels",
    description:
      "Remove a channel from mixetape, with its posts and their history; nothing changes on the platform. Refused while the channel has posts waiting to go out — cancel them first (cancel_post). Only when the user asks for it.",
    inputSchema: object(
      { accountId: { type: "string", description: "Account id (list_accounts)" } },
      ["accountId"],
    ),
    annotations: { destructiveHint: true },
    run: (userId, input) => social.disconnectAccount(userId, input.string("accountId")),
  },
  {
    name: "connect_channel",
    scope: "channels",
    description:
      "Start connecting a channel: returns a sign-in link for the platform. Give the link to the user — they open it in any browser, sign in with the account that owns the channel and allow access; nothing is connected until they do. The link works once, for 10 minutes. Then call get_connection with the returned state.",
    inputSchema: object(
      {
        platform: {
          type: "string",
          enum: PLATFORMS,
          description: "The platform to connect; one mixetape has no app for yet is refused",
        },
        account: {
          type: "string",
          description:
            "Who is connecting, where the platform needs it: the Mastodon account (@you@mastodon.social — its server is what counts), or a Bluesky handle (optional)",
        },
      },
      ["platform"],
    ),
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
    name: "get_connection",
    scope: "channels",
    description:
      "Where a connect_channel attempt stands. 'pending': the user has not finished yet (ask again shortly). 'done': channels lists what was connected or refreshed. 'choose': the sign-in reached several new channels (e.g. Facebook Pages) — ask the user which to add, then call choose_channels; refreshed lists channels that were already connected and just got new access. 'error': why it failed.",
    inputSchema: object({ state: STATE }, ["state"]),
    annotations: READ_ONLY,
    run: (userId, input) => social.connectResult(userId, input.string("state")),
  },
  {
    name: "choose_channels",
    scope: "channels",
    description:
      "Add the channels the user picked after get_connection answered 'choose'. The choice is held for 10 minutes after the sign-in; channels left out are not connected.",
    inputSchema: object(
      {
        state: STATE,
        platformAccountIds: {
          type: "array",
          items: { type: "string" },
          description: "platformAccountId of each chosen channel, from get_connection's choices",
        },
      },
      ["state", "platformAccountIds"],
    ),
    run: async (userId, input) => {
      const ids = input.strings("platformAccountIds") ?? [];
      if (!ids.length) throw new ServiceError("Choose at least one channel");
      return social.chooseChannels(userId, input.string("state"), ids);
    },
  },

  // brands: the user's groups of channels
  {
    name: "list_brands",
    scope: "read",
    description:
      "List the brands — the user's groups of connected channels (e.g. Hans Explainer: its YouTube channel and Facebook Page) — each with its accountIds (list_accounts ids).",
    inputSchema: object({}),
    annotations: READ_ONLY,
    run: (userId) => brands.listBrands(userId),
  },
  {
    name: "create_brand",
    scope: "channels",
    description: "Group connected channels as a brand.",
    inputSchema: object(BRAND_FIELDS, ["name"]),
    run: (userId, input) =>
      brands.createBrand(userId, {
        name: input.string("name"),
        accountIds: input.strings("accountIds"),
      }),
  },
  {
    name: "update_brand",
    scope: "channels",
    description: "Rename a brand and/or replace its channels (accountIds replaces the whole list).",
    inputSchema: object({ id: id("Brand id (list_brands)"), ...BRAND_FIELDS }, ["id"]),
    run: (userId, input) =>
      brands.updateBrand(userId, input.string("id"), {
        name: input.optionalString("name"),
        accountIds: input.strings("accountIds"),
      }),
  },
  {
    name: "delete_brand",
    scope: "channels",
    description: "Delete a brand. Its channels stay connected.",
    inputSchema: object({ id: { type: "string", description: "Brand id (list_brands)" } }, ["id"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => brands.deleteBrand(userId, input.string("id")),
  },

  // analytics
  {
    name: "get_post_analytics",
    scope: "analytics",
    needs: "analytics",
    description:
      "A post's analytics: views, watch time, average view duration and percentage, likes, comments, shares, subscribers gained/lost, the audience-retention curve and traffic sources. Defaults to the day it went up through today; the last ~3 days are incomplete.",
    inputSchema: object({ id: POST_ID, ...RANGE }, ["id"]),
    annotations: READ_ONLY,
    run: (userId, input) =>
      analytics.postAnalytics(userId, input.string("id"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
  {
    name: "get_account_analytics",
    scope: "analytics",
    needs: "accountAnalytics",
    description:
      "An account's analytics: totals, day by day, its top 10 posts (with the mixetape post id when published through mixetape) and traffic sources. Defaults to the last 28 days; the last ~3 days are incomplete.",
    inputSchema: object({ accountId: ACCOUNT_ID, ...RANGE }, ["accountId"]),
    annotations: READ_ONLY,
    run: (userId, input) =>
      analytics.accountAnalytics(userId, input.string("accountId"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
];
