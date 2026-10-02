import { createFileRoute } from "@tanstack/react-router";
import { ENDPOINTS } from "#/modules/api/endpoints";
import { handle } from "#/modules/api/rest";

// /api/v1/* — the REST API. Every endpoint is declared in its module (*.rest.ts) and routed
// by modules/api/rest.ts; the same list builds /api/v1/openapi.json.
const serve = ({ request }: { request: Request }) => handle(request, ENDPOINTS);

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: { GET: serve, POST: serve, PUT: serve, PATCH: serve, DELETE: serve },
  },
});
