import { createFileRoute } from "@tanstack/react-router";
import { deauthorizedOnPlatform, metaCallbackUser } from "#/modules/social/access.service";

// POST /api/connect/{facebook|instagram|threads}/deauthorize — Meta's deauthorize (Threads:
// uninstall) callback, when someone removes mixetape on the platform. The signed_request
// names them; their accounts lose their tokens and show "reconnect", as on any revocation.
export const Route = createFileRoute("/api/connect/$provider/deauthorize")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = await metaCallbackUser(params.provider, request);
        if (!userId) return Response.json({ error: "Invalid signed_request" }, { status: 400 });
        return Response.json(await deauthorizedOnPlatform(params.provider, userId));
      },
    },
  },
});
