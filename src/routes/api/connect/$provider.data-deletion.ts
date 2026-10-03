import { createFileRoute } from "@tanstack/react-router";
import { deletionRequestedOnPlatform, metaCallbackUser } from "#/modules/social/access.service";
import { siteUrl } from "#/modules/social/social.service";

// POST /api/connect/{facebook|instagram|threads}/data-deletion — Meta's data deletion
// request callback. The signed_request names the person; their accounts and posts are
// deleted, and Meta gets the status page and confirmation code it shows them.
export const Route = createFileRoute("/api/connect/$provider/data-deletion")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = await metaCallbackUser(params.provider, request);
        if (!userId) return Response.json({ error: "Invalid signed_request" }, { status: 400 });
        const { code } = await deletionRequestedOnPlatform(params.provider, userId);
        return Response.json({
          url: `${siteUrl()}/data-deletion?code=${code}`,
          confirmation_code: code,
        });
      },
    },
  },
});
