import type { JWK } from "jose";
import type { ConnectCapability, ConnectedAccount, TokenGrant } from "../types";
import {
  APPVIEW,
  authServerFor,
  clientFor,
  newDpopKey,
  pushRequest,
  requestTokens,
  SCOPE,
  verifiedPds,
  type TokenSet,
} from "./oauth";
import type { RefreshState, Session } from "./session";

/**
 * Connecting a Bluesky account with AT Protocol OAuth (oauth.ts). The handle is optional:
 * without one the person signs in on Bluesky's own server, which hosts most accounts; with
 * one, on whichever server hosts theirs, with the handle filled in.
 */

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

export async function profileOf(did: string): Promise<ConnectedAccount> {
  const res = await fetch(
    `${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    { headers: { Accept: "application/json" } },
  );
  const profile = (await res.json().catch(() => ({}))) as {
    handle?: string;
    displayName?: string;
    avatar?: string;
  };
  return {
    platformAccountId: did,
    name: profile.displayName?.trim() || profile.handle || did,
    handle: profile.handle ? `@${profile.handle}` : undefined,
    avatar: profile.avatar,
  };
}

/** Stores a token set as an access session and a refresh state (each JSON). */
function grantOf(
  tokens: TokenSet,
  base: Omit<Session, "token">,
  extra: { tokenEndpoint: string; clientId: string },
): TokenGrant {
  const session: Session = { ...base, token: tokens.access_token };
  const refresh: RefreshState | undefined = tokens.refresh_token
    ? { ...base, ...extra, refresh: tokens.refresh_token }
    : undefined;
  return {
    accessToken: JSON.stringify(session),
    refreshToken: refresh && JSON.stringify(refresh),
    expiresIn: tokens.expires_in ?? 900,
    scopes: (tokens.scope ?? SCOPE).split(" ").filter(Boolean),
  };
}

export const blueskyConnect: ConnectCapability = {
  scopes: SCOPE.split(" "),
  asks: {
    label: "Your Bluesky handle",
    placeholder: "you.bsky.social (optional)",
    required: false,
  },

  async begin(app, { redirectUri, state, account }) {
    const client = clientFor(app.clientSecret, redirectUri);
    const { server, did } = await authServerFor(account);
    const dpopKey = await newDpopKey();
    const { verifier, challenge } = await pkce();
    const url = await pushRequest(client, server, {
      state,
      challenge,
      dpopKey,
      loginHint: account?.trim().replace(/^@/, "") || undefined,
    });
    return {
      url,
      context: {
        issuer: server.issuer,
        tokenEndpoint: server.token_endpoint,
        verifier,
        dpopKey: dpopKey as Record<string, string>,
        ...(did && { did }),
      },
    };
  },

  async exchangeCode(app, { code, redirectUri, context, issuer }) {
    const {
      issuer: expected,
      tokenEndpoint,
      verifier,
      dpopKey,
    } = (context ?? {}) as {
      issuer?: string;
      tokenEndpoint?: string;
      verifier?: string;
      dpopKey?: JWK;
    };
    if (!expected || !tokenEndpoint || !verifier || !dpopKey)
      throw new Error("This sign-in expired — connect again");
    // The answer must come from the server the request went to (mix-up protection).
    if (issuer && issuer !== expected) throw new Error("The sign-in came back from another server");

    const client = clientFor(app.clientSecret, redirectUri);
    const tokens = await requestTokens(client, tokenEndpoint, expected, dpopKey, {
      grant_type: "authorization_code",
      code,
      redirect_uri: client.redirectUri,
      code_verifier: verifier,
    });
    const pds = await verifiedPds(tokens.sub, expected);
    return {
      grant: grantOf(
        tokens,
        { did: tokens.sub, pds, issuer: expected, dpopKey },
        { tokenEndpoint, clientId: client.clientId },
      ),
      accounts: [await profileOf(tokens.sub)],
    };
  },

  async refresh(app, refreshToken) {
    const state = JSON.parse(refreshToken) as RefreshState;
    // The client the tokens were issued to: the development client keeps no key.
    const client = state.clientId.startsWith("http://localhost")
      ? { clientId: state.clientId, redirectUri: "" }
      : { ...clientFor(app.clientSecret, "https://x.invalid"), clientId: state.clientId };
    const tokens = await requestTokens(client, state.tokenEndpoint, state.issuer, state.dpopKey, {
      grant_type: "refresh_token",
      refresh_token: state.refresh,
    });
    const grant = grantOf(
      tokens,
      { did: state.did, pds: state.pds, issuer: state.issuer, dpopKey: state.dpopKey },
      { tokenEndpoint: state.tokenEndpoint, clientId: state.clientId },
    );
    return {
      accessToken: grant.accessToken,
      expiresIn: grant.expiresIn,
      refreshToken: grant.refreshToken,
    };
  },

  accounts: async (token) => [await profileOf((JSON.parse(token) as Session).did)],
};
