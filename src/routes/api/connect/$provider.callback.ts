import { createFileRoute } from "@tanstack/react-router";
import { completeConnect } from "#/modules/social/social.service";

// GET /api/connect/youtube/callback — where the platform returns after consent. The
// state parameter, not the browser session, identifies the user: it was stored in KV when
// the flow started and is valid once, for ten minutes.
export const Route = createFileRoute("/api/connect/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const back = (query: string) => Response.redirect(`${url.origin}/channels?${query}`, 302);

        const denied = url.searchParams.get("error");
        if (denied)
          return back(`error=${encodeURIComponent(`Access was not granted (${denied})`)}`);

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state)
          return back(`error=${encodeURIComponent("The sign-in response was incomplete")}`);

        try {
          const { channels } = await completeConnect(params.provider, code, state);
          return back(`connected=${encodeURIComponent(channels.join(", "))}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not connect the account";
          return back(`error=${encodeURIComponent(message)}`);
        }
      },
    },
  },
});
