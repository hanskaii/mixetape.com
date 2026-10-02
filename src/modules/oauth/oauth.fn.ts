import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { API_SCOPES, isScope } from "#/modules/api/api-keys.service";
import { currentUserId, getAuth } from "#/modules/auth/auth.server";
import { listConnectedApps } from "./oauth.service";

/**
 * Server functions behind the OAuth pages (/oauth/login, /oauth/consent) and Connected
 * apps. The flow itself is Better Auth's: the pages call authClient.oauth2.continue and
 * authClient.oauth2.consent, which carry the signed authorization request along.
 */

/** Better Auth stores array fields as JSON text on SQLite. */
const scopesOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(/[ ,]/).filter(Boolean);
  }
};

/** What the consent page shows: the app, the permissions it asks for, who is signed in. */
export const getConsentRequest = createServerFn({ method: "GET" })
  .validator((data: { clientId?: string; scope?: string }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (!data.clientId) return { ok: false as const, error: "The request does not name its app" };
    const client = await auth.api
      .getOAuthClientPublic({ headers, query: { client_id: data.clientId } })
      .catch(() => null);
    if (!client) return { ok: false as const, error: "This app is not registered with mixetape" };
    const requested = (data.scope ?? "").split(" ").filter(Boolean);
    const permissions = requested.filter(isScope);
    return {
      ok: true as const,
      client: {
        name: client.client_name ?? "An MCP client",
        uri: client.client_uri ?? null,
      },
      // Identity scopes (openid, offline_access…) pass through untouched. The person may
      // narrow the permissions the app asked for, never widen them (Better Auth refuses).
      passThrough: requested.filter((scope) => !isScope(scope)),
      permissions: permissions.map((scope) => ({ scope, label: API_SCOPES[scope] })),
      email: session?.user.email ?? null,
    };
  });

export const getConnectedApps = createServerFn({ method: "GET" }).handler(async () => {
  const apps = await listConnectedApps(await currentUserId());
  return apps.map((app) => ({
    ...app,
    name: app.name ?? "MCP client",
    scopes: scopesOf(app.scopes).filter(isScope),
  }));
});

/** Disconnects an app: Better Auth drops its consent and tokens. */
export const disconnectApp = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await currentUserId();
    await (
      await getAuth()
    ).api.deleteOAuthConsent({
      headers: getRequestHeaders(),
      body: { id: data.id },
    });
  });
