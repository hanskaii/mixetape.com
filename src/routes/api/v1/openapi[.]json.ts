import { createFileRoute } from "@tanstack/react-router";
import { openApiDocument } from "#/modules/api/openapi";
import { siteUrl } from "#/modules/social/social.service";

// GET /api/v1/openapi.json — the REST API as OpenAPI 3.1, built from the endpoint list.
// No key needed: it describes the API, it does not use it. docs/ copies it for its reference.
export const Route = createFileRoute("/api/v1/openapi.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(openApiDocument(siteUrl()), {
          headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
        }),
    },
  },
});
