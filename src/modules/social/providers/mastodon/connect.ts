import { env } from "cloudflare:workers";
import { decrypt, encrypt } from "#/modules/secrets/crypto";
import type { ConnectCapability, ConnectedAccount } from "../types";
import { encodeSession, mastodon, readSession, serverOf, type MastodonSession } from "./api";

/**
 * Connecting a Mastodon account. There is no one Mastodon app: mixetape registers itself
 * with the person's server the first time someone from that server connects (POST
 * /api/v1/apps) and keeps that registration. The consent uses PKCE where the server
 * supports it (Mastodon 4.3+; older servers ignore it). Mastodon tokens do not expire;
 * "refreshing" checks the token still works, so a revoked one asks for reconnecting.
 */

const SCOPES = ["read:accounts", "read:statuses", "write:statuses", "write:media"];
const CHECK_EVERY = 30 * 24 * 60 * 60; // seconds

type ServerApp = { clientId: string; clientSecret: string };

async function serverApp(server: string, redirectUri: string): Promise<ServerApp> {
  const key = `mastodon:app:${new URL(server).hostname}:${redirectUri}`;
  const saved = await env.KIT_CACHE.get(key);
  if (saved) return JSON.parse(await decrypt(saved)) as ServerApp;

  const res = await fetch(`${server}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "mixetape",
      redirect_uris: redirectUri,
      scopes: SCOPES.join(" "),
      website: new URL(redirectUri).origin,
    }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as {
    client_id?: string;
    client_secret?: string;
  } | null;
  if (!res?.ok || !data?.client_id || !data.client_secret)
    throw new Error(`${new URL(server).hostname} does not look like a Mastodon server`);
  const app = { clientId: data.client_id, clientSecret: data.client_secret };
  await env.KIT_CACHE.put(key, await encrypt(JSON.stringify(app)));
  return app;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

type Credentials = {
  id: string;
  username: string;
  acct: string;
  display_name?: string;
  avatar?: string;
};

export async function accountOf(session: MastodonSession): Promise<ConnectedAccount> {
  const me = await mastodon<Credentials>(session, "/api/v1/accounts/verify_credentials");
  const host = new URL(session.server).hostname;
  return {
    platformAccountId: `${me.id}@${host}`,
    name: me.display_name?.trim() || me.username,
    handle: `@${me.username}@${host}`,
    avatar: me.avatar,
  };
}

export const mastodonConnect: ConnectCapability = {
  scopes: SCOPES,
  asks: {
    label: "Your Mastodon account",
    placeholder: "@you@mastodon.social",
    required: true,
  },

  async begin(_app, { redirectUri, state, account }) {
    const server = serverOf(account ?? "");
    const app = await serverApp(server, redirectUri);
    const { verifier, challenge } = await pkce();
    const params = new URLSearchParams({
      client_id: app.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return {
      url: `${server}/oauth/authorize?${params}`,
      context: { server, ...app, verifier },
    };
  },

  async exchangeCode(_app, { code, redirectUri, context }) {
    const { server, clientId, clientSecret, verifier } = context as Record<string, string>;
    if (!server) throw new Error("This sign-in expired — connect again");
    const res = await fetch(`${server}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: SCOPES.join(" "),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      scope?: string;
      error_description?: string;
      error?: string;
    };
    if (!res.ok || !data.access_token)
      throw new Error(
        `Mastodon sign-in failed: ${data.error_description ?? data.error ?? res.status}`,
      );
    const session = { server, token: data.access_token };
    const stored = encodeSession(session);
    return {
      grant: {
        accessToken: stored,
        refreshToken: stored,
        expiresIn: CHECK_EVERY,
        scopes: (data.scope ?? SCOPES.join(" ")).split(/[ ,]+/).filter(Boolean),
      },
      accounts: [await accountOf(session)],
    };
  },

  // Nothing to refresh: confirm the token still works (a revoked one reconnects).
  async refresh(_app, refreshToken) {
    await accountOf(readSession(refreshToken));
    return { accessToken: refreshToken, expiresIn: CHECK_EVERY };
  },

  accounts: async (token) => [await accountOf(readSession(token))],
};
