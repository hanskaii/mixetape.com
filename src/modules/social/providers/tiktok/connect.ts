import type { ConnectCapability, TokenGrant } from "../types";
import { OPEN_API, tiktok } from "./api";

/**
 * TikTok Login Kit. Access tokens last 24 hours; the refresh token (a year) rotates on
 * every refresh, and mixetape keeps the newest.
 */
const SCOPES = ["user.info.basic", "video.publish"];

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function token(params: Record<string, string>): Promise<TokenGrant & { openId?: string }> {
  const res = await fetch(`${OPEN_API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`TikTok login failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 86_400,
    scopes: (data.scope ?? "").split(",").filter(Boolean),
    openId: data.open_id,
  };
}

export const tiktokConnect: ConnectCapability = {
  scopes: SCOPES,

  authorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_key: clientId,
      scope: SCOPES.join(","),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },

  async exchangeCode(app, { code, redirectUri }) {
    const grant = await token({
      client_key: app.clientId,
      client_secret: app.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const missing = SCOPES.filter((scope) => !grant.scopes.includes(scope));
    if (missing.length) {
      throw new Error(
        `TikTok did not grant ${missing.join(", ")}. Connect again and allow every permission.`,
      );
    }
    const info = await tiktok<{
      user?: { open_id?: string; display_name?: string; avatar_url?: string };
    }>(grant.accessToken, "user/info/", {
      method: "GET",
      query: { fields: "open_id,display_name,avatar_url" },
    });
    const user = info.user ?? {};
    const { openId, ...rest } = grant;
    return {
      grant: rest,
      accounts: [
        {
          platformAccountId: user.open_id ?? openId ?? "",
          name: user.display_name || "TikTok",
          avatar: user.avatar_url,
        },
      ],
    };
  },

  async refresh(app, refreshToken) {
    const grant = await token({
      client_key: app.clientId,
      client_secret: app.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    return {
      accessToken: grant.accessToken,
      expiresIn: grant.expiresIn,
      refreshToken: grant.refreshToken,
    };
  },
};
