import type { JsonValue } from "#/database/schema";
import { requireScope, type ApiScope, type Caller } from "./api-keys.service";
import * as analytics from "./analytics.service";
import * as platform from "./platform.service";
import { PROVIDER_LIST, capabilitiesOf, getProvider, type Metadata } from "./providers";
import * as social from "./social.service";

/**
 * Everything an agent can do in mixetape, in one registry. MCP (/mcp) and REST
 * (/api/v1/tools/:name) both serve it, and each tool needs one API-key permission.
 * A tool is a thin adapter: it reads its arguments and calls a service.
 */

export type Tool = {
  name: string;
  description: string;
  scope: ApiScope;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (userId: string, input: Input) => Promise<unknown>;
};

/** A tool's arguments, read with the type each one should have. */
export class Input {
  constructor(private readonly args: Record<string, unknown>) {}

  private bad(name: string, what: string): never {
    throw new social.ServiceError(`${name} must be ${what}`);
  }

  string(name: string): string {
    const value = this.optionalString(name);
    if (!value) throw new social.ServiceError(`${name} is required`);
    return value;
  }

  optionalString(name: string): string | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "string" ? value : this.bad(name, "text");
  }

  number(name: string): number | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "number" && Number.isFinite(value) ? value : this.bad(name, "a number");
  }

  boolean(name: string): boolean | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "boolean" ? value : this.bad(name, "true or false");
  }

  strings(name: string): string[] | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value
      : this.bad(name, "a list of text");
  }

  object(name: string): Metadata | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, JsonValue>)
      : this.bad(name, "an object");
  }
}

// ── schemas ──────────────────────────────────────────────────────────────────

const id = (description: string) => ({ type: "string", description });
const POST_ID = id("mixetape post id (list_posts)");
const ACCOUNT_ID = id("mixetape account id (list_accounts)");
const DATE = (what: string) => ({ type: "string", description: `${what}, YYYY-MM-DD` });

function object(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties, ...(required.length && { required }) };
}

/** Each platform's metadata schema; one platform needs no union. */
function metadataSchema(pick?: (provider: string) => readonly string[] | undefined) {
  const schemas = PROVIDER_LIST.map(({ id: providerId, name }) => {
    const schema = getProvider(providerId).metadata.schema as {
      properties?: Record<string, unknown>;
    };
    const fields = pick?.(providerId);
    const properties = fields
      ? Object.fromEntries(
          Object.entries(schema.properties ?? {}).filter(([key]) => fields.includes(key)),
        )
      : schema.properties;
    return { ...schema, title: name, properties };
  });
  return schemas.length === 1 ? schemas[0] : { anyOf: schemas };
}

const METADATA = metadataSchema();
const EDITABLE_METADATA = metadataSchema((providerId) => getProvider(providerId).editing?.fields);

const READ = { readOnlyHint: true };

// ── tools ────────────────────────────────────────────────────────────────────

export const TOOLS: Tool[] = [
  // read
  {
    name: "list_accounts",
    scope: "read",
    description:
      "List the connected channels: id, platform, name, handle, status, and the capabilities its platform supports (e.g. comments, analytics). status 'reconnect' means the channel must be reconnected on /channels first (also after mixetape asks for new permissions).",
    inputSchema: object({}),
    annotations: READ,
    run: async (userId) =>
      (await social.listAccounts(userId)).map((account) => ({
        id: account.id,
        provider: account.provider,
        platformAccountId: account.platformAccountId,
        name: account.name.trim(),
        handle: account.handle,
        status: account.status,
        capabilities: capabilitiesOf(getProvider(account.provider)),
      })),
  },
  {
    name: "list_posts",
    scope: "read",
    description:
      "List posts, newest scheduled time first. Statuses: scheduled (waiting in mixetape, editable with update_post), publishing (uploading), uploaded (on the platform, private until its time), published (live; change with edit_published_post), failed, cancelled.",
    inputSchema: object({
      status: { type: "array", items: { type: "string" }, description: "Only these statuses" },
      from: { type: "string", description: "ISO time; scheduled at or after" },
      to: { type: "string", description: "ISO time; scheduled at or before" },
      limit: { type: "number", description: "Default 50, max 500" },
    }),
    annotations: READ,
    run: (userId, input) => {
      const date = (name: string) => {
        const value = input.optionalString(name);
        return value ? new Date(value) : undefined;
      };
      return social.listPosts(userId, {
        status: input.strings("status"),
        from: date("from"),
        to: date("to"),
        limit: input.number("limit") ?? 50,
      });
    },
  },
  {
    name: "get_post",
    scope: "read",
    description: "One post with its status, error, platform link and attempts.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ,
    run: (userId, input) => social.getPost(userId, input.string("id")),
  },
  {
    name: "get_post_insights",
    scope: "read",
    description:
      "How a post that is on the platform stands right now: visibility, processing, scheduled publish time, any rejection, plus lifetime views, likes and comments. For watch time and retention use get_post_analytics.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ,
    run: (userId, input) => platform.postInsights(userId, input.string("id")),
  },
  {
    name: "list_collections",
    scope: "read",
    description:
      "List the account's collections — playlists on YouTube — with id, title, visibility and item count. Use an id in metadata.playlistIds or add_to_collection.",
    inputSchema: object({ accountId: ACCOUNT_ID }, ["accountId"]),
    annotations: READ,
    run: (userId, input) => platform.listCollections(userId, input.string("accountId")),
  },
  {
    name: "list_captions",
    scope: "read",
    description:
      "List the caption tracks of a post on the platform (language, name, kind; 'asr' is automatic).",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: READ,
    run: (userId, input) => platform.listCaptions(userId, input.string("id")),
  },

  // publish
  {
    name: "create_post",
    scope: "publish",
    description:
      "Schedule a video on a connected account. Like Buffer, the post waits in mixetape (editable, cancellable) and is uploaded leadMinutes before scheduledAt as private; YouTube processes it and makes it public at scheduledAt. Thumbnail, playlists and captions in metadata are applied right after upload; firstComment is posted once it is public. mediaUrl: a public https URL or an r2:// key uploaded to mixetape.",
    inputSchema: object(
      {
        accountId: ACCOUNT_ID,
        mediaUrl: { type: "string" },
        caption: { type: "string" },
        scheduledAt: {
          type: "string",
          description:
            "ISO 8601 with timezone offset — when it goes live. Omit to post now (live after leadMinutes).",
        },
        leadMinutes: {
          type: "number",
          description:
            "Minutes before go-live that mixetape uploads it (YouTube default 30), so the platform can finish processing HD first. 0 uploads at go-live time.",
        },
        metadata: METADATA,
      },
      ["accountId", "mediaUrl"],
    ),
    run: (userId, input) =>
      social.createPost(userId, {
        accountId: input.string("accountId"),
        mediaUrl: input.string("mediaUrl"),
        caption: input.optionalString("caption"),
        scheduledAt: input.optionalString("scheduledAt"),
        leadMinutes: input.number("leadMinutes"),
        metadata: input.object("metadata"),
      }),
  },
  {
    name: "update_post",
    scope: "publish",
    description:
      "Change a post that is still 'scheduled' (waiting in mixetape): its time, lead, media, caption or metadata (merged; null clears a field). Once it is on the platform, use edit_published_post.",
    inputSchema: object(
      {
        id: POST_ID,
        mediaUrl: { type: "string" },
        caption: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 with timezone offset" },
        leadMinutes: { type: "number" },
        metadata: METADATA,
      },
      ["id"],
    ),
    run: (userId, input) => {
      const changes: social.EditPostInput = {};
      const mediaUrl = input.optionalString("mediaUrl");
      const caption = input.optionalString("caption");
      const scheduledAt = input.optionalString("scheduledAt");
      const leadMinutes = input.number("leadMinutes");
      const metadata = input.object("metadata");
      if (mediaUrl !== undefined) changes.mediaUrl = mediaUrl;
      if (caption !== undefined) changes.caption = caption;
      if (scheduledAt !== undefined) changes.scheduledAt = scheduledAt;
      if (leadMinutes !== undefined) changes.leadMinutes = leadMinutes;
      if (metadata !== undefined) changes.metadata = metadata;
      return social.editPost(userId, input.string("id"), changes);
    },
  },
  {
    name: "cancel_post",
    scope: "publish",
    description: "Cancel a post that is still 'scheduled'.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => social.cancelPost(userId, input.string("id")),
  },
  {
    name: "retry_post",
    scope: "publish",
    description:
      "Send a 'failed' post again — now, or at its original time if that is still ahead.",
    inputSchema: object({ id: POST_ID }, ["id"]),
    run: (userId, input) => social.retryPost(userId, input.string("id")),
  },
  {
    name: "set_thumbnail",
    scope: "publish",
    description:
      "Set or replace the custom thumbnail of a post already on YouTube. imageUrl: public https JPEG/PNG, ≤ 2 MB, 1280×720; the channel must be verified. For a post still 'scheduled', use update_post with metadata.thumbnailUrl.",
    inputSchema: object({ id: POST_ID, imageUrl: { type: "string" } }, ["id", "imageUrl"]),
    annotations: { idempotentHint: true },
    run: (userId, input) =>
      platform.setPostThumbnail(userId, input.string("id"), input.string("imageUrl")),
  },

  // manage
  {
    name: "edit_published_post",
    scope: "manage",
    description:
      "Change the details of a post that is already on the platform (uploaded or published): title, description, tags, category, privacy, made-for-kids, language and localizations. Only the given fields change; null clears one. Costs 50 YouTube quota units.",
    inputSchema: object({ id: POST_ID, metadata: EDITABLE_METADATA }, ["id", "metadata"]),
    annotations: { idempotentHint: true },
    run: (userId, input) =>
      platform.editPublishedPost(userId, input.string("id"), input.object("metadata") ?? {}),
  },
  {
    name: "create_collection",
    scope: "manage",
    description: "Create a collection (a YouTube playlist) on the account.",
    inputSchema: object(
      {
        accountId: ACCOUNT_ID,
        title: { type: "string" },
        description: { type: "string" },
        visibility: { type: "string", enum: ["public", "unlisted", "private"] },
      },
      ["accountId", "title"],
    ),
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
    description:
      "Add a post that is on the platform to a collection (YouTube playlist). position 0 puts it first; omitted puts it last. For a post still 'scheduled', set metadata.playlistIds instead.",
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
    description:
      "Upload a subtitle track (public https SRT or WebVTT) to a post on the platform. A track with the same language and name is replaced. Costs 400–450 YouTube quota units.",
    inputSchema: object(
      {
        id: POST_ID,
        language: { type: "string", description: 'BCP-47, e.g. "en", "id"' },
        name: { type: "string", description: "Track name; empty is the default track" },
        url: { type: "string" },
        isDraft: { type: "boolean", description: "Upload without publishing the track" },
      },
      ["id", "language", "url"],
    ),
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
    description:
      "Read the comments on a post (with replies). Comment ids are what reply_to_comment and moderate_comment take. held: true lists comments held for review.",
    inputSchema: object(
      {
        id: POST_ID,
        limit: { type: "number", description: "1–100, default 20" },
        order: { type: "string", enum: ["time", "relevance"] },
        held: { type: "boolean" },
      },
      ["id"],
    ),
    annotations: READ,
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
    description:
      "Post a comment on a public post as the channel itself — e.g. from a Short, a link to the full video. The API cannot pin it; pin it in YouTube Studio.",
    inputSchema: object({ id: POST_ID, text: { type: "string" } }, ["id", "text"]),
    run: (userId, input) => platform.postComment(userId, input.string("id"), input.string("text")),
  },
  {
    name: "reply_to_comment",
    scope: "comments",
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
    description:
      "Publish, hold for review, or reject (hide) a comment on one of the account's posts. banAuthor with 'rejected' also hides the author's future comments.",
    inputSchema: object(
      {
        id: POST_ID,
        commentId: { type: "string" },
        status: { type: "string", enum: ["published", "heldForReview", "rejected"] },
        banAuthor: { type: "boolean" },
      },
      ["id", "commentId", "status"],
    ),
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

  // analytics
  {
    name: "get_post_analytics",
    scope: "analytics",
    description:
      "A post's analytics: views, watch time, average view duration and percentage, likes, comments, shares, subscribers gained/lost, the audience-retention curve and traffic sources. Defaults to the day it went up through today; the last ~3 days are incomplete.",
    inputSchema: object({ id: POST_ID, from: DATE("First day"), to: DATE("Last day") }, ["id"]),
    annotations: READ,
    run: (userId, input) =>
      analytics.postAnalytics(userId, input.string("id"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
  {
    name: "get_account_analytics",
    scope: "analytics",
    description:
      "An account's analytics: totals, day by day, its top 10 posts (with the mixetape post id when published through mixetape) and traffic sources. Defaults to the last 28 days; the last ~3 days are incomplete.",
    inputSchema: object({ accountId: ACCOUNT_ID, from: DATE("First day"), to: DATE("Last day") }, [
      "accountId",
    ]),
    annotations: READ,
    run: (userId, input) =>
      analytics.accountAnalytics(userId, input.string("accountId"), {
        from: input.optionalString("from"),
        to: input.optionalString("to"),
      }),
  },
];

export const findTool = (name: string) => TOOLS.find((tool) => tool.name === name);

/** The tools a caller may use, as agents see them. */
export function toolsFor(caller: Caller) {
  return TOOLS.filter((tool) => caller.scopes.includes(tool.scope)).map(
    ({ name, description, scope, inputSchema, annotations }) => ({
      name,
      description: `${description} [permission: ${scope}]`,
      inputSchema,
      ...(annotations && { annotations }),
    }),
  );
}

/** Runs a tool as the caller, after checking the caller's permission for it. */
export async function runTool(caller: Caller, tool: Tool, args: Record<string, unknown>) {
  requireScope(caller, tool.scope);
  return tool.run(caller.userId, new Input(args));
}
