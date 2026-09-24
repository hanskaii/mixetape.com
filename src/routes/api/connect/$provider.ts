import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "#/modules/social/http";
import { ServiceError, startConnect } from "#/modules/social/social.service";

// GET /api/connect/youtube?credential=<id> — sends the signed-in user to the platform's
// consent screen, using the OAuth app (credential) they chose.
export const Route = createFileRoute("/api/connect/$provider")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const userId = await requireUser(request, { allowApiKey: false });
          const credentialId = url.searchParams.get("credential");
          if (!credentialId) throw new ServiceError("Choose which app credential to connect with");
          return Response.redirect(await startConnect(userId, credentialId), 302);
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
