import { createFileRoute } from "@tanstack/react-router";
import { handleMessage, type JsonRpcMessage } from "#/modules/social/mcp";
import { userForApiKey } from "#/modules/social/social.service";

// POST https://mixetape.com/mcp — the MCP endpoint (Streamable HTTP, stateless, JSON
// responses). Authorization: Bearer mxt_… (an API key from /api-keys).
//
//   claude mcp add --transport http mixetape https://mixetape.com/mcp \
//     --header "Authorization: Bearer mxt_…"
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await userForApiKey(request);
        if (!userId) {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32001, message: "Unauthorized — send Authorization: Bearer mxt_…" },
            },
            { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="mixetape"' } },
          );
        }

        const body = (await request.json().catch(() => null)) as
          | JsonRpcMessage
          | JsonRpcMessage[]
          | null;
        if (!body) {
          return Response.json(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
            { status: 400 },
          );
        }

        const messages = Array.isArray(body) ? body : [body];
        const replies = (
          await Promise.all(messages.map((message) => handleMessage(userId, message)))
        ).filter((reply) => reply !== null);
        // Only notifications: acknowledged with no body, as the transport expects.
        if (replies.length === 0) return new Response(null, { status: 202 });
        return Response.json(Array.isArray(body) ? replies : replies[0]);
      },

      // This server keeps no streams open; clients fall back to plain POSTs.
      GET: async () =>
        new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
