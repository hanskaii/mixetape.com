import * as social from "./social.service";

/**
 * mixetape as an MCP server (Streamable HTTP, stateless). An agent with an API key gets
 * the same powers as the dashboard: see channels, schedule, reschedule, cancel and retry
 * posts, and read how a post is doing on the platform.
 *
 * Every call runs as the key's owner through social.service, so ownership checks are the
 * same ones the UI and REST API rely on.
 */

export const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;
export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};
type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

const youtubeMetadata = {
  type: "object",
  description: "YouTube fields. title is required when creating.",
  properties: {
    title: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 5000 },
    category: { type: "string", description: 'YouTube category id, e.g. "27" Education' },
    tags: { type: "array", items: { type: "string" } },
    privacyStatus: { type: "string", enum: ["public", "unlisted", "private"] },
    madeForKids: { type: "boolean" },
    notifySubscribers: { type: "boolean" },
  },
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  run: (userId: string, args: Record<string, any>) => Promise<unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "list_accounts",
    description:
      "List the connected channels (id, platform, name, handle, status). Use an account id when creating posts. A status of 'reconnect' means the channel must be reconnected on /channels before it can post.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (userId) => {
      const accounts = await social.listAccounts(userId);
      return accounts.map(({ id, provider, platformAccountId, name, handle, status }) => ({
        id,
        provider,
        platformAccountId,
        name: name.trim(),
        handle,
        status,
      }));
    },
  },
  {
    name: "list_posts",
    description:
      "List posts, newest scheduled time first. Statuses: scheduled, publishing, uploaded (on the platform, goes live at its scheduled time), published, failed, cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "array", items: { type: "string" }, description: "Only these statuses" },
        from: { type: "string", description: "ISO time; scheduled at or after" },
        to: { type: "string", description: "ISO time; scheduled at or before" },
        limit: { type: "number", description: "Default 50, max 500" },
      },
    },
    annotations: { readOnlyHint: true },
    run: (userId, args) =>
      social.listPosts(userId, {
        status: args.status,
        from: args.from ? new Date(args.from) : undefined,
        to: args.to ? new Date(args.to) : undefined,
        limit: args.limit ?? 50,
      }),
  },
  {
    name: "get_post",
    description: "One post with its status, error, platform link and attempts.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: true },
    run: (userId, args) => social.getPost(userId, args.id),
  },
  {
    name: "get_post_insights",
    description:
      "How a published or uploaded post is doing on the platform right now: visibility, processing, scheduled publish time, any rejection, plus views, likes and comments.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: true },
    run: (userId, args) => social.postInsights(userId, args.id),
  },
  {
    name: "create_post",
    description:
      "Schedule a video on a connected channel. mediaUrl must be a public https URL (e.g. a public R2 object) or an r2:// key uploaded to mixetape. Omit scheduledAt to post as soon as possible. YouTube posts more than 15 minutes ahead are uploaded at once and published by YouTube at scheduledAt.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        mediaUrl: { type: "string" },
        caption: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 with timezone offset" },
        metadata: youtubeMetadata,
      },
      required: ["accountId", "mediaUrl"],
    },
    run: (userId, args) => social.createPost(userId, args as social.CreatePostInput),
  },
  {
    name: "update_post",
    description:
      "Change a post that is still 'scheduled': its time, media, caption or metadata (metadata fields are merged). Once a post is uploaded or published, change it on the platform instead.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        mediaUrl: { type: "string" },
        caption: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 with timezone offset" },
        metadata: youtubeMetadata,
      },
      required: ["id"],
    },
    run: (userId, { id, ...changes }) => social.editPost(userId, id, changes),
  },
  {
    name: "cancel_post",
    description: "Cancel a post that is still 'scheduled'.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { destructiveHint: true },
    run: (userId, args) => social.cancelPost(userId, args.id),
  },
  {
    name: "retry_post",
    description:
      "Send a 'failed' post again — now, or at its original time if that is still ahead.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: (userId, args) => social.retryPost(userId, args.id),
  },
];

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Answers one JSON-RPC message; notifications (no id) get no answer. */
export async function handleMessage(
  userId: string,
  message: JsonRpcMessage,
): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  const isNotification = message.id === undefined;

  switch (message.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: (message.params?.protocolVersion as string) ?? PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mixetape", version: "1.0.0" },
        instructions:
          "mixetape schedules videos to connected social channels (YouTube today). Start with list_accounts, then create_post. Times are ISO 8601 with an offset.",
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          ...(annotations && { annotations }),
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((candidate) => candidate.name === message.params?.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(message.params?.name)}`);
      try {
        const result = await tool.run(
          userId,
          (message.params?.arguments as Record<string, any>) ?? {},
        );
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        // A tool that fails answers with isError, so the agent sees why and can adjust.
        const text =
          error instanceof social.ServiceError ? error.message : "The tool failed unexpectedly";
        if (!(error instanceof social.ServiceError)) console.error("[mcp]", error);
        return ok(id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return fail(id, -32601, `Method not found: ${String(message.method)}`);
  }
}
