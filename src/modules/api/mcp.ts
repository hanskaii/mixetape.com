import type { Caller } from "./api-keys.service";
import { ServiceError } from "#/modules/api/errors";
import { findTool, runTool, toolsFor } from "./tools";

/**
 * mixetape as an MCP server (Streamable HTTP, stateless): the JSON-RPC side only. The
 * tools live in tools.ts, shared with REST; an agent sees just the tools its API key has
 * permission for, and every call runs as the key's owner through the same services the
 * dashboard uses.
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

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Answers one JSON-RPC message; notifications (no id) get no answer. */
export async function handleMessage(
  caller: Caller,
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
          "mixetape schedules videos to connected social channels (YouTube, Facebook Pages, Instagram, Threads, TikTok and Pinterest) and manages them once live: details, playlists, captions, comments and analytics. Start with list_accounts, then create_post; to add a channel, connect_channel gives the user a sign-in link. Local files go to mixetape storage with create_upload, one PUT, then finish_upload; an agent can upload into a library group (create_group, groupId) with the words drafted, for the user to publish in a few clicks. Times are ISO 8601 with an offset.",
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: toolsFor(caller) });
    case "tools/call": {
      const tool = findTool(String(message.params?.name));
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(message.params?.name)}`);
      try {
        const args = message.params?.arguments;
        const result = await runTool(
          caller,
          tool,
          args && typeof args === "object" ? (args as Record<string, unknown>) : {},
        );
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        // A tool that fails answers with isError, so the agent sees why and can adjust.
        const text = error instanceof ServiceError ? error.message : "The tool failed unexpectedly";
        if (!(error instanceof ServiceError)) console.error("[mcp]", error);
        return ok(id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return fail(id, -32601, `Method not found: ${String(message.method)}`);
  }
}
