import type { ConnectCapability } from "../types";
import { THREADS, threads } from "./api";

/**
 * Threads Login. One Threads profile per consent. Long-lived tokens last 60 days and are
 * refreshed into a new one; mixetape refreshes a week before expiry so an idle account
 * does not lapse.
 */
const SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_read_replies",
  "threads_manage_replies",
  "threads_manage_insights",
];

const WEEK = 7 * 24 * 60 * 60;
const early = (expiresIn: number | undefined) =>
  Math.max(3600, (expiresIn ?? 60 * 24 * 3600) - WEEK);

type Token = { access_token: string; expires_in?: number };

async function call(url: string, init?: RequestInit): Promise<Token> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Token & {
    error?: { message?: string };
    error_message?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Threads login failed: ${data.error?.message ?? data.error_message ?? res.status}`,
    );
  }
  return data;
}

export const threadsConnect: ConnectCapability = {
  scopes: SCOPES,

  authorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(","),
      response_type: "code",
      state,
    });
    return `https://threads.com/oauth/authorize?${params}`;
  },

  async exchangeCode(app, { code, redirectUri }) {
    const short = await call(`${THREADS.replace("/v1.0", "")}/oauth/access_token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const long = await call(
      `${THREADS.replace("/v1.0", "")}/access_token?${new URLSearchParams({
        grant_type: "th_exchange_token",
        client_secret: app.clientSecret,
        access_token: short.access_token,
      })}`,
    );
    const me = await threads<{
      id: string;
      username?: string;
      name?: string;
      threads_profile_picture_url?: string;
    }>(long.access_token, "me", {
      params: { fields: "id,username,name,threads_profile_picture_url" },
    });
    // Threads grants all requested permissions or none.
    const grant = {
      accessToken: long.access_token,
      refreshToken: long.access_token,
      expiresIn: early(long.expires_in),
      scopes: SCOPES,
    };
    return {
      grant,
      accounts: [
        {
          platformAccountId: me.id,
          name: me.name || me.username || "Threads",
          handle: me.username ? `@${me.username}` : undefined,
          avatar: me.threads_profile_picture_url,
        },
      ],
    };
  },

  async refresh(_app, token) {
    const refreshed = await call(
      `${THREADS.replace("/v1.0", "")}/refresh_access_token?${new URLSearchParams({
        grant_type: "th_refresh_token",
        access_token: token,
      })}`,
    );
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.access_token,
      expiresIn: early(refreshed.expires_in),
    };
  },
};
