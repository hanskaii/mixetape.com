import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "#/database/index";
import { oauthClient, oauthConsent } from "#/database/schema";
import { isScope, type Caller } from "#/modules/api/api-keys.service";
import { getAuth, mcpResource } from "#/modules/auth/auth.server";

/**
 * The resource-server side of OAuth for MCP clients. Better Auth (jwt, mcp, cimd plugins in
 * auth.server.ts) registers clients, asks the person, and issues access tokens: JWTs signed
 * with its key, for the /mcp audience, carrying the approved permissions as scopes. Here a
 * token is checked locally against that key — no request to ourselves — and becomes a
 * Caller like an API key.
 */

const JWKS_TTL = 5 * 60 * 1000;
let cached: { at: number; keys: ReturnType<typeof createLocalJWKSet> } | undefined;

async function signingKeys() {
  if (cached && Date.now() - cached.at < JWKS_TTL) return cached.keys;
  const jwks = (await (await getAuth()).api.getJwks()) as JSONWebKeySet;
  cached = { at: Date.now(), keys: createLocalJWKSet(jwks) };
  return cached.keys;
}

/** The caller behind an OAuth access token, or null when it is not a valid one for /mcp. */
export async function callerForOAuthToken(token: string): Promise<Caller | null> {
  if (token.split(".").length !== 3) return null;
  const auth = await getAuth();
  const { baseURL } = await auth.$context;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, await signingKeys(), {
      issuer: baseURL,
      audience: mcpResource(),
    }));
  } catch {
    return null;
  }
  const userId = payload.sub;
  const clientId = (payload.azp ?? payload.client_id) as string | undefined;
  if (!userId || !clientId) return null;
  // Disconnecting an app deletes its consent: its tokens stop working at once, not when
  // they expire.
  const consent = await db.query.oauthConsent.findFirst({
    where: and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)),
  });
  if (!consent) return null;
  const scopes = String(payload.scope ?? "")
    .split(" ")
    .filter(isScope);
  return { userId, scopes };
}

/** The apps a person connected over OAuth, with what each may do. */
export async function listConnectedApps(userId: string) {
  return db
    .select({
      id: oauthConsent.id,
      scopes: oauthConsent.scopes,
      createdAt: oauthConsent.createdAt,
      updatedAt: oauthConsent.updatedAt,
      name: oauthClient.name,
      uri: oauthClient.uri,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
    .where(eq(oauthConsent.userId, userId));
}
