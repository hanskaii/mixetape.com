import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "#/modules/auth/auth.server";
import { PROVIDER_LIST } from "./providers";
import * as apiKeys from "#/modules/api/api-keys.service";
import * as social from "./social.service";

/**
 * Server functions behind the app's pages. Each one resolves the signed-in user and hands
 * off to social.service, the same code the REST API uses.
 */

async function currentUserId(): Promise<string> {
  const headers = getRequestHeaders();
  const session = headers
    ? await (await getAuth()).api.getSession({ headers }).catch(() => null)
    : null;
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

// ── queue ─────────────────────────────────────────────────────────────────────
// Posts arrive from agents (MCP / API); the workspace only watches and steps in.

export const getQueueData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [accounts, posts] = await Promise.all([
    social.listAccounts(userId),
    social.listPosts(userId, { limit: 200 }),
  ]);
  return { accounts, posts };
});

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.cancelPost(await currentUserId(), data.id));

export const retryFailedPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.retryPost(await currentUserId(), data.id));

// ── channels (credentials + connected accounts) ──────────────────────────────

export const getChannelsData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  // Providers mixetape has its own app for get a credential automatically, so the user
  // never has to add one. See social.service#ensureManagedCredential.
  await Promise.all(PROVIDER_LIST.map((p) => social.ensureManagedCredential(userId, p.id)));
  const [credentials, accounts] = await Promise.all([
    social.listCredentials(userId),
    social.listAccounts(userId),
  ]);
  return {
    providers: PROVIDER_LIST,
    credentials,
    accounts,
    redirectUris: Object.fromEntries(PROVIDER_LIST.map((p) => [p.id, social.redirectUri(p.id)])),
  };
});

export const addCredential = createServerFn({ method: "POST" })
  .validator(
    (data: { provider: string; label: string; clientId: string; clientSecret: string }) => data,
  )
  .handler(async ({ data }) => social.createCredential(await currentUserId(), data));

export const replaceCredentialSecret = createServerFn({ method: "POST" })
  .validator((data: { id: string; clientSecret: string }) => data)
  .handler(async ({ data }) =>
    social.updateCredentialSecret(await currentUserId(), data.id, data.clientSecret),
  );

export const removeCredential = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.deleteCredential(await currentUserId(), data.id));

export const beginChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { credentialId: string }) => data)
  .handler(async ({ data }) => social.beginConnect(await currentUserId(), data.credentialId));

export const checkChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { state: string }) => data)
  .handler(async ({ data }) => social.connectResult(await currentUserId(), data.state));

export const removeAccount = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.deleteAccount(await currentUserId(), data.id));

// ── API keys ──────────────────────────────────────────────────────────────────

export const getApiKeys = createServerFn({ method: "GET" }).handler(async () => {
  return {
    keys: await apiKeys.listApiKeys(await currentUserId()),
    scopes: apiKeys.API_SCOPES,
    baseUrl: social.siteUrl(),
  };
});

export const createApiKey = createServerFn({ method: "POST" })
  .validator((data: { name: string; scopes: string[] }) => data)
  .handler(async ({ data }) => apiKeys.createApiKey(await currentUserId(), data.name, data.scopes));

export const removeApiKey = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => apiKeys.deleteApiKey(await currentUserId(), data.id));
