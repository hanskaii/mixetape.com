import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/modules/auth/auth.server";
import { PROVIDER_LIST } from "./providers";
import * as social from "./social.service";

/**
 * Server functions behind the app's pages. Each one resolves the signed-in user and hands
 * off to social.service, the same code the REST API uses.
 */

async function currentUserId(): Promise<string> {
  const headers = getRequestHeaders();
  const session = headers ? await auth.api.getSession({ headers }).catch(() => null) : null;
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

// ── publish (queue + composer) ────────────────────────────────────────────────

export const getPublishData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [accounts, posts] = await Promise.all([
    social.listAccounts(userId),
    social.listPosts(userId, { limit: 200 }),
  ]);
  return { accounts, posts };
});

export const schedulePost = createServerFn({ method: "POST" })
  .validator((data: social.CreatePostInput) => data)
  .handler(async ({ data }) => social.createPost(await currentUserId(), data));

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.cancelPost(await currentUserId(), data.id));

export const retryFailedPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.retryPost(await currentUserId(), data.id));

// ── channels (credentials + connected accounts) ──────────────────────────────

export const getChannelsData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
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
  return { keys: await social.listApiKeys(await currentUserId()), baseUrl: social.siteUrl() };
});

export const createApiKey = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => social.createApiKey(await currentUserId(), data.name));

export const removeApiKey = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.deleteApiKey(await currentUserId(), data.id));
