import type { AppCredentials, TokenGrant } from "../types";
import { GRAPH, GRAPH_VERSION, graph } from "./graph";

/**
 * Facebook Login, for Facebook Pages (Instagram signs in with Instagram Login instead). The
 * code becomes a long-lived user token, which makes the Page tokens listed by
 * /me/accounts non-expiring; they stop working only when the person revokes the app,
 * changes their password or loses the Page role, and the account is then reconnected.
 */

/** Page tokens do not expire; this only keeps the refresh logic from running. */
export const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

export type MetaPage = {
  id: string;
  name: string;
  username?: string;
  access_token?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  };
};

export function metaAuthorizeUrl(
  scopes: readonly string[],
  { clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string },
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: scopes.join(","),
    // Ask again for anything the person declined last time.
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

type TokenResponse = { access_token: string; expires_in?: number };

async function exchange(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams(params)}`);
  const data = (await res.json().catch(() => ({}))) as TokenResponse & {
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Facebook login failed: ${data.error?.message ?? res.status}`);
  }
  return data;
}

/**
 * Finishes Facebook Login: a long-lived user token, the permissions actually granted
 * (refusing a consent that left any required one out), and the person's Pages.
 */
export async function metaLogin(
  app: AppCredentials,
  { code, redirectUri }: { code: string; redirectUri: string },
  scopes: Record<string, string>,
  pageFields: string,
): Promise<{ user: TokenGrant; granted: string[]; pages: MetaPage[] }> {
  const short = await exchange({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const user = await exchange({
    grant_type: "fb_exchange_token",
    client_id: app.clientId,
    client_secret: app.clientSecret,
    fb_exchange_token: short.access_token,
  });

  const permissions = await graph<{ data?: { permission: string; status: string }[] }>(
    user.access_token,
    "me/permissions",
  );
  const granted = (permissions.data ?? [])
    .filter((item) => item.status === "granted")
    .map((item) => item.permission);
  const missing = Object.entries(scopes)
    .filter(([scope]) => !granted.includes(scope))
    .map(([, label]) => label);
  if (missing.length) {
    throw new Error(
      `Facebook did not grant permission to ${missing.join(", ")}. Connect again and allow every permission.`,
    );
  }

  const pages = await graph<{ data?: MetaPage[] }>(user.access_token, "me/accounts", {
    params: { fields: pageFields, limit: 100 },
  });
  return {
    user: {
      accessToken: user.access_token,
      expiresIn: user.expires_in ?? 60 * 24 * 60 * 60,
      scopes: granted,
    },
    granted,
    pages: pages.data ?? [],
  };
}

/** A Page token as an account's own grant; kept as the "refresh token" too. */
export function pageGrant(token: string, granted: string[]): TokenGrant {
  return { accessToken: token, refreshToken: token, expiresIn: TEN_YEARS, scopes: granted };
}

/** Nothing to refresh on a Page token: confirm it still works (a revoked one reconnects). */
export async function refreshPageToken(token: string) {
  await graph(token, "me", { params: { fields: "id" } });
  return { accessToken: token, expiresIn: TEN_YEARS };
}
