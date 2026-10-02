import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/modules/auth/auth.server";

// /.well-known/oauth-protected-resource[/mcp], /.well-known/oauth-authorization-server/…
// and /.well-known/openid-configuration/…: OAuth discovery for MCP clients, served by
// Better Auth's mcp plugin (auth.server.ts). Any origin may read it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "MCP-Protocol-Version",
};

// Clients from before RFC 8414 path insertion look at the root; the issuer is /api/auth.
const ALIASES: Record<string, string> = {
  "/.well-known/oauth-authorization-server": "/.well-known/oauth-authorization-server/api/auth",
  "/.well-known/openid-configuration": "/api/auth/.well-known/openid-configuration",
};

async function discovery(request: Request) {
  const url = new URL(request.url);
  const alias = ALIASES[url.pathname.replace(/\/$/, "")];
  if (alias) url.pathname = alias;
  const response = await (await getAuth()).handler(alias ? new Request(url, request) : request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

export const Route = createFileRoute("/.well-known/$")({
  server: {
    handlers: {
      GET: ({ request }) => discovery(request),
      HEAD: ({ request }) => discovery(request),
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
