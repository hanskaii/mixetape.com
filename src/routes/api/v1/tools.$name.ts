import { createFileRoute } from "@tanstack/react-router";
import { requireCaller, respond } from "#/modules/api/http";
import { ServiceError } from "#/modules/api/errors";
import { findTool, runTool } from "#/modules/api/tools";

// POST /api/v1/tools/:name { …arguments } — runs one tool, exactly as MCP's tools/call does:
//
//   curl -X POST https://mixetape.com/api/v1/tools/get_account_analytics \
//     -H "Authorization: Bearer mxt_…" -H "Content-Type: application/json" \
//     -d '{ "accountId": "…", "from": "2026-09-01" }'
export const Route = createFileRoute("/api/v1/tools/$name")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        respond(async () => {
          const caller = await requireCaller(request);
          const tool = findTool(params.name);
          if (!tool) throw new ServiceError(`Unknown tool: ${params.name}`, 404);
          const body = await request.json().catch(() => ({}));
          const args =
            body && typeof body === "object" && !Array.isArray(body)
              ? (body as Record<string, unknown>)
              : {};
          return { result: await runTool(caller, tool, args) };
        }),
    },
  },
});
