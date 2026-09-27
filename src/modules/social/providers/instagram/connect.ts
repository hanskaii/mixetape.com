import { ReconnectRequiredError, type ConnectCapability } from "../types";
import { ig } from "./api";

/**
 * Instagram Login: the person signs in on instagram.com with a professional (Business or
 * Creator) account, which becomes one account — no Facebook Page involved. The token lasts
 * 60 days and is refreshed into a new one; mixetape refreshes a week before expiry.
 */
const SCOPES = {
  instagram_business_basic: "see your profile",
  instagram_business_content_publish: "publish to Instagram",
  instagram_business_manage_comments: "answer and moderate comments",
  instagram_business_manage_insights: "read insights",
} as const;

const WEEK = 7 * 24 * 60 * 60;
const early = (expiresIn: number | undefined) =>
  Math.max(3600, (expiresIn ?? 60 * 24 * 3600) - WEEK);

type Answer = {
  access_token?: string;
  expires_in?: number;
  user_id?: string | number;
  permissions?: string | string[];
  // Newer API versions wrap the code exchange's answer in data[].
  data?: Answer[];
  error?: { message?: string; code?: number } | string;
  error_message?: string;
};

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const answer = (await res.json().catch(() => ({}))) as Answer;
  const data = answer.data?.[0] ?? answer;
  if (res.ok && data.access_token) return { ...data, access_token: data.access_token };
  const error = typeof answer.error === "object" ? answer.error : undefined;
  const message = answer.error_message ?? error?.message ?? String(answer.error ?? res.status);
  if (error?.code === 190) throw new ReconnectRequiredError(`Instagram: ${message}`);
  throw new Error(`Instagram login failed: ${message}`);
}

export const instagramConnect: ConnectCapability = {
  scopes: Object.keys(SCOPES),

  authorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: Object.keys(SCOPES).join(","),
      state,
      // Always ask which account, so several accounts can be connected one after another.
      force_reauth: "true",
    });
    return `https://www.instagram.com/oauth/authorize?${params}`;
  },

  async exchangeCode(app, { code, redirectUri }) {
    const short = await call("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const granted =
      typeof short.permissions === "string"
        ? short.permissions.split(",").map((scope) => scope.trim())
        : (short.permissions ?? []);
    const missing = Object.entries(SCOPES)
      .filter(([scope]) => !granted.includes(scope))
      .map(([, label]) => label);
    if (missing.length) {
      throw new Error(
        `Instagram did not grant permission to ${missing.join(", ")}. Connect again and allow every permission.`,
      );
    }

    const long = await call(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: app.clientSecret,
        access_token: short.access_token,
      })}`,
    );
    const me = await ig<{
      user_id?: string | number;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    }>(long.access_token, "me", {
      params: { fields: "user_id,username,name,profile_picture_url" },
    });

    return {
      grant: {
        accessToken: long.access_token,
        refreshToken: long.access_token,
        expiresIn: early(long.expires_in),
        scopes: granted,
      },
      accounts: [
        {
          // The professional account's id, which the publishing endpoints take.
          platformAccountId: String(me.user_id ?? short.user_id),
          name: me.name || me.username || "Instagram",
          handle: me.username ? `@${me.username}` : undefined,
          avatar: me.profile_picture_url,
        },
      ],
    };
  },

  async refresh(_app, token) {
    const refreshed = await call(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
        grant_type: "ig_refresh_token",
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
