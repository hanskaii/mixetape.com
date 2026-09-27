import type { ConnectCapability, TokenGrant } from "../types";
import { PINTEREST, pinterest } from "./api";

/**
 * Pinterest OAuth with continuous refresh: the access token lasts 30 days, the refresh
 * token 60 days and is renewed on every refresh, so an account in use never lapses.
 * Pinterest requires a business account for publishing through the API.
 */
const SCOPES = ["boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read"];

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  message?: string;
};

async function token(
  app: { clientId: string; clientSecret: string },
  params: Record<string, string>,
): Promise<TokenGrant> {
  const res = await fetch(`${PINTEREST}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${app.clientId}:${app.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...params, continuous_refresh: "true" }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token)
    throw new Error(`Pinterest login failed: ${data.message ?? res.status}`);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 30 * 24 * 3600,
    scopes: (data.scope ?? "").split(/[ ,]+/).filter(Boolean),
  };
}

export const pinterestConnect: ConnectCapability = {
  scopes: SCOPES,

  authorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
    });
    return `https://www.pinterest.com/oauth/?${params}`;
  },

  async exchangeCode(app, { code, redirectUri }) {
    const grant = await token(app, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const missing = SCOPES.filter((scope) => !grant.scopes.includes(scope));
    if (missing.length) {
      throw new Error(
        `Pinterest did not grant ${missing.join(", ")}. Connect again and allow every permission.`,
      );
    }
    const account = await pinterest<{
      username?: string;
      business_name?: string;
      profile_image?: string;
      account_type?: string;
      id?: string;
    }>(grant.accessToken, "user_account");
    if (account.account_type && account.account_type !== "BUSINESS") {
      throw new Error(
        "Pinterest publishes through the API from business accounts only; convert the account first.",
      );
    }
    return {
      grant,
      accounts: [
        {
          platformAccountId: account.id ?? account.username ?? "",
          name: account.business_name || account.username || "Pinterest",
          handle: account.username ? `@${account.username}` : undefined,
          avatar: account.profile_image,
        },
      ],
    };
  },

  async refresh(app, refreshToken) {
    const grant = await token(app, { grant_type: "refresh_token", refresh_token: refreshToken });
    return {
      accessToken: grant.accessToken,
      expiresIn: grant.expiresIn,
      refreshToken: grant.refreshToken,
    };
  },
};
