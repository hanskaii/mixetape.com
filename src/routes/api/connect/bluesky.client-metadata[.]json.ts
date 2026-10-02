import { createFileRoute } from "@tanstack/react-router";
import { secret } from "#/modules/secrets/secrets.service";
import { metadataUrl, publicJwk, SCOPE } from "#/modules/social/providers/bluesky/oauth";
import { redirectUri, siteUrl } from "#/modules/social/social.service";

// GET /api/connect/bluesky/client-metadata.json — who mixetape is to Bluesky: its URL is
// the client id (AT Protocol OAuth), with the public half of mixetape's signing key.
export const Route = createFileRoute("/api/connect/bluesky/client-metadata.json")({
  server: {
    handlers: {
      GET: async () => {
        const key = await secret("BLUESKY_PRIVATE_KEY");
        if (!key) return new Response("Bluesky is not set up", { status: 404 });
        const site = siteUrl();
        return Response.json(
          {
            client_id: metadataUrl(site),
            client_name: "mixetape",
            client_uri: site,
            logo_uri: `${site}/favicon.svg`,
            tos_uri: `${site}/terms`,
            policy_uri: `${site}/privacy`,
            application_type: "web",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            redirect_uris: [redirectUri("bluesky")],
            scope: SCOPE,
            token_endpoint_auth_method: "private_key_jwt",
            token_endpoint_auth_signing_alg: "ES256",
            dpop_bound_access_tokens: true,
            jwks: { keys: [publicJwk(key)] },
          },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
