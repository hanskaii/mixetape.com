import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import { PROVIDER_LIST } from "./providers";
import * as apiKeys from "#/modules/api/api-keys.service";
import * as brands from "./brands.service";
import * as social from "./social.service";

/**
 * Server functions behind the app's pages. Each one resolves the signed-in user and hands
 * off to social.service, the same code the REST API uses.
 */

// ── queue ─────────────────────────────────────────────────────────────────────
// Posts arrive from agents (MCP / API); the workspace only watches and steps in.

export const getQueueData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [accounts, { posts }] = await Promise.all([
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

// ── channels ──────────────────────────────────────────────────────────────────

export const getChannelsData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [accounts, connectable, brandList] = await Promise.all([
    social.listAccounts(userId),
    social.connectableProviders(),
    brands.listBrands(userId),
  ]);
  return { providers: PROVIDER_LIST, connectable, accounts, brands: brandList };
});

export const saveBrand = createServerFn({ method: "POST" })
  .validator((data: { id?: string; name: string; accountIds: string[] }) => data)
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const input = { name: data.name, accountIds: data.accountIds };
    return data.id ? brands.updateBrand(userId, data.id, input) : brands.createBrand(userId, input);
  });

export const removeBrand = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => brands.deleteBrand(await currentUserId(), data.id));

export const beginChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { provider: string; account?: string }) => data)
  .handler(async ({ data }) =>
    social.beginConnect(await currentUserId(), data.provider, "workspace", data.account),
  );

export const checkChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { state: string }) => data)
  .handler(async ({ data }) => social.connectResult(await currentUserId(), data.state));

export const chooseConnectChannels = createServerFn({ method: "POST" })
  .validator((data: { state: string; platformAccountIds: string[] }) => data)
  .handler(async ({ data }) =>
    social.chooseChannels(await currentUserId(), data.state, data.platformAccountIds),
  );

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
