import { createFileRoute } from "@tanstack/react-router";
import { toolCatalog } from "#/modules/api/tools";

// GET /mcp/tools.json — every MCP tool with its permission, the platforms it works on and its
// input schema. No key needed: it describes the tools, it does not run them. docs/ copies it
// for its tools reference, as it does /api/v1/openapi.json for the REST reference.
export const Route = createFileRoute("/mcp_/tools.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { tools: toolCatalog() },
          {
            headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
          },
        ),
    },
  },
});
