import { createFileRoute } from "@tanstack/react-router";
import { requireCaller, respond } from "#/modules/api/http";
import { toolsFor } from "#/modules/api/tools";

// GET /api/v1/tools — the tools this API key may call, with their input schemas. The same
// tools the MCP server offers; call one with POST /api/v1/tools/:name.
export const Route = createFileRoute("/api/v1/tools")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        respond(async () => ({ tools: toolsFor(await requireCaller(request)) })),
    },
  },
});
