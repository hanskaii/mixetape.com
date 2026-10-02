import { createFileRoute } from "@tanstack/react-router";
import { handleMessage, type JsonRpcMessage } from "#/modules/api/mcp";
import { callerForBearer } from "#/modules/api/http";
import { siteUrl } from "#/modules/social/social.service";

// POST https://mixetape.com/mcp — the MCP endpoint (Streamable HTTP, stateless, JSON
// responses). Authorization: Bearer with an API key (mxt_…, from /api-keys) or an OAuth
// access token (mxo_…): a client without one is answered 401 with where to sign in
// (/.well-known/oauth-protected-resource/mcp), so it connects with no key to paste.
//
//   claude mcp add --transport http mixetape https://mixetape.com/mcp
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await callerForBearer(request);
        if (!caller) {
          const sent = request.headers.has("authorization");
          const metadata = `${siteUrl()}/.well-known/oauth-protected-resource/mcp`;
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32001,
                message: "Unauthorized — sign in with OAuth, or send Authorization: Bearer mxt_…",
              },
            },
            {
              status: 401,
              headers: {
                "WWW-Authenticate": `Bearer realm="mixetape", resource_metadata="${metadata}"${sent ? ', error="invalid_token"' : ""}`,
              },
            },
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
          await Promise.all(messages.map((message) => handleMessage(caller, message)))
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
