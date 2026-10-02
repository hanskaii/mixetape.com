import { importJWK, SignJWT, type JWK } from "jose";
import { ReconnectRequiredError } from "../types";

/**
 * AT Protocol OAuth, the way Bluesky asks a confidential web client to do it
 * (atproto.com/specs/oauth): the person's PDS names its authorization server; mixetape
 * pushes the request first (PAR), proves its identity with a signed assertion
 * (private_key_jwt, ES256), and binds every token to a key of the session's own (DPoP).
 * Servers hand out DPoP nonces; a request refused for want of a fresh one is sent again.
 *
 * Running locally, mixetape is an atproto development client (client id
 * "http://localhost?…", loopback redirect, no key), so connecting can be tried without
 * mixetape's key.
 */

export const SCOPE = "atproto transition:generic";
export const APPVIEW = "https://public.api.bsky.app";
const ENTRYWAY = "https://bsky.social";

// ── who mixetape is ──────────────────────────────────────────────────────────

export type Client = {
  clientId: string;
  redirectUri: string;
  /** mixetape's private key; absent for the local development client. */
  key?: JWK & { kid: string };
};

const isLoopback = (url: URL) => url.hostname === "localhost" || url.hostname === "127.0.0.1";

/** The client metadata's URL, which is the client id (see the client-metadata.json route). */
export const metadataUrl = (origin: string) => `${origin}/api/connect/bluesky/client-metadata.json`;

/** mixetape as a client, from its key (the Secrets Store) and its callback. */
export function clientFor(privateKey: string, redirectUri: string): Client {
  const callback = new URL(redirectUri);
  if (isLoopback(callback)) {
    callback.hostname = "127.0.0.1"; // atproto development clients must use the IP
    const redirect = callback.toString();
    const params = new URLSearchParams({ redirect_uri: redirect, scope: SCOPE });
    return { clientId: `http://localhost?${params}`, redirectUri: redirect };
  }
  const key = JSON.parse(privateKey) as JWK & { kid?: string };
  if (!key.d || !key.kid) throw new Error("The Bluesky key must be a private ES256 JWK with a kid");
  return { clientId: metadataUrl(callback.origin), redirectUri, key: { ...key, kid: key.kid } };
}

/** The public half of mixetape's key, for its client metadata. */
export function publicJwk(privateKey: string) {
  const { d: _d, ...publicKey } = JSON.parse(privateKey) as JWK;
  return { ...publicKey, use: "sig", alg: "ES256" };
}

/** The signed client assertion that authenticates a confidential client at `audience`. */
async function clientAssertion(client: Client, audience: string): Promise<Record<string, string>> {
  if (!client.key) return {};
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "ES256", kid: client.key.kid })
    .setIssuer(client.clientId)
    .setSubject(client.clientId)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(await importJWK(client.key, "ES256"));
  return {
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  };
}

// ── identity ─────────────────────────────────────────────────────────────────

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return (await res.json()) as T;
}

/** A handle's DID. */
export async function resolveHandle(handle: string): Promise<string> {
  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  if (clean.startsWith("did:")) return clean;
  try {
    const { did } = await json<{ did: string }>(
      `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`,
    );
    return did;
  } catch {
    throw new Error(`No Bluesky account is called "${handle}"`);
  }
}

/** The PDS a DID's data lives on. */
export async function pdsOf(did: string): Promise<string> {
  const doc = did.startsWith("did:plc:")
    ? await json<{ service?: { id: string; serviceEndpoint: string }[] }>(
        `https://plc.directory/${did}`,
      )
    : did.startsWith("did:web:")
      ? await json<{ service?: { id: string; serviceEndpoint: string }[] }>(
          `https://${did.slice("did:web:".length)}/.well-known/did.json`,
        )
      : null;
  const pds = doc?.service?.find((service) => service.id.endsWith("#atproto_pds"));
  if (!pds) throw new Error(`Could not find where ${did} keeps its posts`);
  return pds.serviceEndpoint.replace(/\/$/, "");
}

/** The authorization server a PDS trusts. */
async function authorizationServerOf(pds: string): Promise<string> {
  const { authorization_servers } = await json<{ authorization_servers?: string[] }>(
    `${pds}/.well-known/oauth-protected-resource`,
  );
  if (!authorization_servers?.[0]) throw new Error(`${pds} names no authorization server`);
  return authorization_servers[0].replace(/\/$/, "");
}

export type AuthServer = {
  issuer: string;
  pushed_authorization_request_endpoint: string;
  authorization_endpoint: string;
  token_endpoint: string;
};

async function authServer(issuer: string): Promise<AuthServer> {
  const metadata = await json<AuthServer>(`${issuer}/.well-known/oauth-authorization-server`);
  if (metadata.issuer !== issuer)
    throw new Error("The authorization server's metadata is not its own");
  return metadata;
}

/** Where to sign in: the account's own authorization server, or Bluesky's when unknown. */
export async function authServerFor(account?: string) {
  if (!account) return { server: await authServer(ENTRYWAY), did: undefined };
  const did = await resolveHandle(account);
  return { server: await authServer(await authorizationServerOf(await pdsOf(did))), did };
}

/** Checks the account really is served by the issuer that signed it in; its PDS. */
export async function verifiedPds(did: string, issuer: string) {
  const pds = await pdsOf(did);
  if ((await authorizationServerOf(pds)) !== issuer)
    throw new Error("The account is not served by the server that signed it in");
  return pds;
}

// ── DPoP ─────────────────────────────────────────────────────────────────────

export async function newDpopKey(): Promise<JWK> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JWK;
}

const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function proof(key: JWK, method: string, url: string, nonce?: string, accessToken?: string) {
  const { d: _d, key_ops: _ops, ext: _ext, ...jwk } = key as JWK & { ext?: boolean };
  const target = new URL(url);
  target.search = "";
  target.hash = "";
  return new SignJWT({
    jti: crypto.randomUUID(),
    htm: method,
    htu: target.toString(),
    ...(nonce && { nonce }),
    ...(accessToken && {
      ath: base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken))),
    }),
  })
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk })
    .setIssuedAt()
    .sign(await importJWK(key, "ES256"));
}

/** The latest DPoP nonce each server gave, per isolate. */
const nonces = new Map<string, string>();

function needsNonce(res: Response, body: string) {
  if (res.status === 400 && body.includes("use_dpop_nonce")) return true;
  return (
    res.status === 401 && (res.headers.get("WWW-Authenticate") ?? "").includes("use_dpop_nonce")
  );
}

/** A DPoP-bound request; sent once more with the server's fresh nonce when it asks. */
export async function dpopFetch(
  key: JWK,
  url: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer | URLSearchParams;
  },
  accessToken?: string,
): Promise<{ res: Response; body: string }> {
  const origin = new URL(url).origin;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        DPoP: await proof(key, init.method, url, nonces.get(origin), accessToken),
        ...(accessToken && { Authorization: `DPoP ${accessToken}` }),
      },
    });
    const nonce = res.headers.get("DPoP-Nonce");
    if (nonce) nonces.set(origin, nonce);
    const body = await res.text();
    if (attempt === 0 && nonce && needsNonce(res, body)) continue;
    return { res, body };
  }
}

// ── authorization ────────────────────────────────────────────────────────────

/** Pushes the authorization request (PAR); returns the URL to send the person to. */
export async function pushRequest(
  client: Client,
  server: AuthServer,
  input: { state: string; challenge: string; dpopKey: JWK; loginHint?: string },
) {
  const { res, body } = await dpopFetch(
    input.dpopKey,
    server.pushed_authorization_request_endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client.clientId,
        response_type: "code",
        redirect_uri: client.redirectUri,
        scope: SCOPE,
        state: input.state,
        code_challenge: input.challenge,
        code_challenge_method: "S256",
        ...(input.loginHint && { login_hint: input.loginHint }),
        ...(await clientAssertion(client, server.issuer)),
      }),
    },
  );
  const data = JSON.parse(body || "{}") as { request_uri?: string; error_description?: string };
  if (!res.ok || !data.request_uri)
    throw new Error(`Bluesky refused to start signing in: ${data.error_description ?? res.status}`);
  const params = new URLSearchParams({ client_id: client.clientId, request_uri: data.request_uri });
  return `${server.authorization_endpoint}?${params}`;
}

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  sub: string;
};

/** The token endpoint: a code or a refresh token, with the session's DPoP key. */
export async function requestTokens(
  client: Client,
  tokenEndpoint: string,
  issuer: string,
  dpopKey: JWK,
  grant: Record<string, string>,
): Promise<TokenSet> {
  const { res, body } = await dpopFetch(dpopKey, tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      ...grant,
      ...(await clientAssertion(client, issuer)),
    }),
  });
  const data = JSON.parse(body || "{}") as TokenSet & {
    error?: string;
    error_description?: string;
  };
  if (data.error === "invalid_grant") throw new ReconnectRequiredError();
  if (!res.ok || !data.access_token || !data.sub)
    throw new Error(
      `Bluesky sign-in failed: ${data.error_description ?? data.error ?? res.status}`,
    );
  if (!(data.scope ?? "").split(" ").includes("atproto"))
    throw new Error("Bluesky did not grant access to the account");
  return data;
}
