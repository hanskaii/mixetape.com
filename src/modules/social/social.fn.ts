import { createServerFn } from "@tanstack/react-start";
import { currentUserId, payingUserId } from "#/modules/auth/auth.server";
import { PROVIDER_LIST } from "./providers";
import * as apiKeys from "#/modules/api/api-keys.service";
import * as brands from "./brands.service";
import * as social from "./social.service";
import { setChannelLock } from "#/modules/billing/billing.service";

/**
 * Server functions behind the app's pages. Each one resolves the signed-in user and hands
 * off to social.service, the same code the REST API uses.
 */

// ── queue ─────────────────────────────────────────────────────────────────────
// Posts arrive from agents (MCP / API); the workspace only watches and steps in.

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.cancelPost(await currentUserId(), data.id));

export const retryFailedPost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.retryPost(await payingUserId(), data.id));

// ── channels ──────────────────────────────────────────────────────────────────

export const getChannelsData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await payingUserId();
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
    const userId = await payingUserId();
    const input = { name: data.name, accountIds: data.accountIds };
    return data.id ? brands.updateBrand(userId, data.id, input) : brands.createBrand(userId, input);
  });

export const removeBrand = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => brands.deleteBrand(await currentUserId(), data.id));

export const beginChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { provider: string; account?: string }) => data)
  .handler(async ({ data }) =>
    social.beginConnect(await payingUserId(), data.provider, "workspace", data.account),
  );

export const checkChannelConnect = createServerFn({ method: "POST" })
  .validator((data: { state: string }) => data)
  .handler(async ({ data }) => social.connectResult(await payingUserId(), data.state));

export const chooseConnectChannels = createServerFn({ method: "POST" })
  .validator((data: { state: string; platformAccountIds: string[] }) => data)
  .handler(async ({ data }) =>
    social.chooseChannels(await payingUserId(), data.state, data.platformAccountIds),
  );

export const removeAccount = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => social.deleteAccount(await currentUserId(), data.id));

/** Picks which channels stay active when more are connected than the plan covers. */
export const setAccountLock = createServerFn({ method: "POST" })
  .validator((data: { id: string; locked: boolean }) => ({
    id: String(data.id),
    locked: data.locked === true,
  }))
  .handler(async ({ data }) => setChannelLock(await payingUserId(), data.id, data.locked));

// ── API keys ──────────────────────────────────────────────────────────────────

export const getApiKeys = createServerFn({ method: "GET" }).handler(async () => {
  return {
    keys: await apiKeys.listApiKeys(await payingUserId()),
    scopes: apiKeys.API_SCOPES,
    baseUrl: social.siteUrl(),
  };
});

export const createApiKey = createServerFn({ method: "POST" })
  .validator((data: { name: string; scopes: string[] }) => data)
  .handler(async ({ data }) => apiKeys.createApiKey(await payingUserId(), data.name, data.scopes));

export const removeApiKey = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => apiKeys.deleteApiKey(await currentUserId(), data.id));
