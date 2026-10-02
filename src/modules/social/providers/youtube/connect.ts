import { ReconnectRequiredError, type ConnectCapability, type ConnectedAccount } from "../types";
import { DATA_API, youtubeFetch } from "./api";

/**
 * Google OAuth for YouTube. Two permissions cover everything mixetape does:
 *   youtube.force-ssl       upload, edit, thumbnails, playlists, captions, comments
 *   yt-analytics.readonly   YouTube Analytics reports
 */
const SCOPES = {
  "https://www.googleapis.com/auth/youtube.force-ssl": "manage your YouTube videos",
  "https://www.googleapis.com/auth/yt-analytics.readonly": "view YouTube Analytics",
} as const;

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
};
type TokenError = { error?: string; error_description?: string };

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse & TokenError;
  if (res.ok && data.access_token) return data;
  // invalid_grant: the user revoked access or the refresh token expired.
  if (data.error === "invalid_grant" && body.grant_type === "refresh_token")
    throw new ReconnectRequiredError();
  throw new Error(`Google OAuth error: ${data.error_description ?? data.error ?? res.status}`);
}

/** The channels the signed-in Google identity owns — the ones videos go to. */
async function ownChannels(token: string): Promise<ConnectedAccount[]> {
  const data = await youtubeFetch<{
    items?: {
      id: string;
      snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
    }[];
  }>(token, `${DATA_API}/channels`, { query: { part: "snippet", mine: true, maxResults: 50 } });
  return (data.items ?? []).map((item) => ({
    platformAccountId: item.id,
    name: item.snippet?.title ?? item.id,
    handle: item.snippet?.customUrl,
    avatar: item.snippet?.thumbnails?.default?.url,
  }));
}

export const youtubeConnect: ConnectCapability = {
  scopes: Object.keys(SCOPES),

  authorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: Object.keys(SCOPES).join(" "),
      state,
      access_type: "offline",
      // Without consent Google only returns a refresh token the first time, and a
      // reconnect would leave the account unable to post once the access token expires.
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async exchangeCode(app, { code, redirectUri }) {
    const token = await requestToken({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
    const scopes = token.scope.split(" ");
    // Google's consent screen lets people untick permissions; mixetape needs all of them.
    const missing = Object.entries(SCOPES)
      .filter(([scope]) => !scopes.includes(scope))
      .map(([, label]) => label);
    if (missing.length) {
      throw new Error(
        `Google did not grant permission to ${missing.join(" and ")}. Connect again and leave every permission ticked.`,
      );
    }

    const accounts = await ownChannels(token.access_token);
    if (!accounts.length) {
      throw new Error(
        "This Google account has no YouTube channel. Create one, or pick the channel's account when signing in.",
      );
    }
    return {
      grant: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in,
        scopes,
      },
      accounts,
    };
  },

  accounts: ownChannels,

  async refresh(app, refreshToken) {
    const token = await requestToken({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    return { accessToken: token.access_token, expiresIn: token.expires_in };
  },
};
