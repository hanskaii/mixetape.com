import { createFileRoute } from "@tanstack/react-router";
import { requireSession } from "#/modules/api/http";
import { startConnect } from "#/modules/social/social.service";

// GET /api/connect/youtube — sends the signed-in user to the platform's consent screen,
// through mixetape's own app for that platform.
export const Route = createFileRoute("/api/connect/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        try {
          const userId = await requireSession(request);
          return Response.redirect(await startConnect(userId, params.provider), 302);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not start connecting";
          return Response.redirect(
            `${url.origin}/channels?error=${encodeURIComponent(message)}`,
            302,
          );
        }
      },
    },
  },
});
