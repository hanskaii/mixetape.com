import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "#/database/index";
import {
  apiKeys,
  providerCredentials,
  socialAccounts,
  socialPosts,
  type ProviderCredential,
  type SocialAccount,
  type JsonValue,
  type SocialPost,
} from "#/database/schema";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto";
import { GoogleAuthFlow } from "./oauth/google-oauth";
import { getProvider, isProvider } from "./providers";
import type { PlatformMetadata } from "./providers";
import { checkLead } from "./timing";

/**
 * Everything mixetape does with credentials, connected accounts, posts and API keys. The
 * UI's server functions, the REST API and the publishing workflow all go through here, so
 * ownership checks and encryption live in exactly one place.
 */

const OAUTH_STATE_TTL = 600; // seconds
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // refresh when less than 5 min remain

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const newId = () => crypto.randomUUID();

export function siteUrl(): string {
  return (env.SITE_URL || env.BETTER_AUTH_URL || "http://localhost:3001").replace(/\/$/, "");
}

export function redirectUri(provider: string): string {
  return `${siteUrl()}/api/connect/${provider}/callback`;
}

// ── credentials ────────────────────────────────────────────────────────────────

export async function listCredentials(userId: string) {
  const rows = await db.query.providerCredentials.findMany({
    where: eq(providerCredentials.userId, userId),
    orderBy: [asc(providerCredentials.createdAt)],
  });
  // The secret never leaves the server; the client id is not secret.
  return rows.map(({ clientSecret: _secret, ...row }) => ({
    ...row,
    redirectUri: redirectUri(row.provider),
  }));
}

export async function createCredential(
  userId: string,
  input: { provider: string; label: string; clientId: string; clientSecret: string },
) {
  if (!isProvider(input.provider))
    throw new ServiceError(`Unsupported provider: ${input.provider}`);
  const label = input.label.trim() || `${input.provider} app`;
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret)
    throw new ServiceError("Client ID and client secret are required");

  const id = newId();
  await db.insert(providerCredentials).values({
    id,
    userId,
    provider: input.provider,
    label,
    clientId,
    clientSecret: await encrypt(clientSecret),
  });
  return { id };
}

export async function deleteCredential(userId: string, id: string) {
  await db
    .delete(providerCredentials)
    .where(and(eq(providerCredentials.id, id), eq(providerCredentials.userId, userId)));
}

async function ownedCredential(userId: string, id: string): Promise<ProviderCredential> {
  const credential = await db.query.providerCredentials.findFirst({
    where: and(eq(providerCredentials.id, id), eq(providerCredentials.userId, userId)),
  });
  if (!credential) throw new ServiceError("Credential not found", 404);
  return credential;
}

// ── connecting accounts (OAuth) ────────────────────────────────────────────────

type OAuthState = { userId: string; credentialId: string; provider: string };

/** What happened to one connect attempt, kept briefly so the page that started it can ask. */
export type ConnectResult =
  | { status: "pending" }
  | { status: "done"; channels: string[] }
  | { status: "error"; error: string };
type StoredResult = Exclude<ConnectResult, { status: "pending" }> & { userId?: string };

/** The URL to send the user to; the state that proves the callback is ours sits in KV. */
export async function startConnect(userId: string, credentialId: string): Promise<string> {
  return (await beginConnect(userId, credentialId)).url;
}

/**
 * Starts connecting a channel and returns the consent URL together with its state, so the
 * page can open the URL in a new tab (or show it to be opened anywhere) and then watch the
 * state until the callback has finished — see connectResult and finishConnect.
 */
export async function beginConnect(userId: string, credentialId: string) {
  const credential = await ownedCredential(userId, credentialId);
  const state = randomToken(24);
  const payload: OAuthState = { userId, credentialId, provider: credential.provider };
  await env.KIT_CACHE.put(`oauth:state:${state}`, JSON.stringify(payload), {
    expirationTtl: OAUTH_STATE_TTL,
  });

  if (credential.provider === "youtube") {
    const url = new GoogleAuthFlow(
      credential.clientId,
      "",
      redirectUri("youtube"),
      state,
    ).redirect();
    return { url, state };
  }
  throw new ServiceError(`Connecting ${credential.provider} is not supported yet`);
}

/**
 * Completes a connect attempt from the platform's callback and remembers the outcome for
 * ten minutes, so whichever page is waiting on this state learns it — even when the
 * consent screen was opened in another browser.
 */
export async function finishConnect(provider: string, code: string, state: string) {
  const resultKey = `oauth:result:${state}`;
  try {
    const { userId, channels } = await completeConnect(provider, code, state);
    const stored: StoredResult = { status: "done", channels, userId };
    await env.KIT_CACHE.put(resultKey, JSON.stringify(stored), { expirationTtl: OAUTH_STATE_TTL });
    return { userId, channels };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect the account";
    // A second use of the same callback (e.g. a pasted URL) keeps the first result.
    if (!(await env.KIT_CACHE.get(resultKey))) {
      const stored: StoredResult = { status: "error", error: message };
      await env.KIT_CACHE.put(resultKey, JSON.stringify(stored), {
        expirationTtl: OAUTH_STATE_TTL,
      });
    }
    throw error;
  }
}

/** Where a connect attempt stands, for the page polling it. */
export async function connectResult(userId: string, state: string): Promise<ConnectResult> {
  const saved = await env.KIT_CACHE.get(`oauth:result:${state}`);
  if (!saved) return { status: "pending" };
  const { userId: owner, ...result } = JSON.parse(saved) as StoredResult;
  if (owner && owner !== userId) return { status: "pending" };
  return result;
}

/**
 * Finishes connecting from a callback URL the user pasted (Step 2 of the connect dialog):
 * the consent screen may have been completed in a browser that could not reach mixetape.
 */
export async function finishConnectFromUrl(userId: string, pasted: string): Promise<ConnectResult> {
  let url: URL;
  try {
    url = new URL(pasted.trim());
  } catch {
    throw new ServiceError("That is not a URL — paste the whole address from the browser");
  }
  const provider = url.pathname.match(/\/api\/connect\/([^/]+)\/callback/)?.[1] ?? "youtube";
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  if (denied) throw new ServiceError(`Access was not granted (${denied})`);
  const code = url.searchParams.get("code");
  if (!code || !state)
    throw new ServiceError("The URL has no code or state — copy it after approving access");

  // The callback may already have run (the browser reached mixetape): reuse its result.
  const earlier = await connectResult(userId, state);
  if (earlier.status !== "pending") return earlier;
  const { userId: owner, channels } = await finishConnect(provider, code, state);
  if (owner !== userId)
    throw new ServiceError("This sign-in was started by another mixetape account", 403);
  return { status: "done", channels };
}

/** Finishes the OAuth dance and stores every channel the signed-in identity owns. */
export async function completeConnect(provider: string, code: string, state: string) {
  const key = `oauth:state:${state}`;
  const saved = await env.KIT_CACHE.get(key);
  if (!saved) throw new ServiceError("This sign-in link expired — start connecting again", 400);
  await env.KIT_CACHE.delete(key); // one use only
  const { userId, credentialId, provider: expected } = JSON.parse(saved) as OAuthState;
  if (expected !== provider) throw new ServiceError("Provider mismatch", 400);

  const credential = await ownedCredential(userId, credentialId);
  const secret = await decrypt(credential.clientSecret);

  if (provider !== "youtube") throw new ServiceError(`Connecting ${provider} is not supported yet`);

  const flow = new GoogleAuthFlow(credential.clientId, secret, redirectUri(provider), state, code);
  await flow.getUserData();
  const channels = await flow.getChannels();
  if (!channels.length) {
    throw new ServiceError(
      `${flow.user?.email ?? "This Google account"} has no YouTube channel. Create one, or pick the channel's account when signing in.`,
    );
  }

  const accessToken = await encrypt(flow.getAccessToken());
  const refreshToken = flow.refreshToken ? await encrypt(flow.refreshToken) : null;
  const expiresAt = new Date(Date.now() + flow.getExpiresIn() * 1000);
  const scopes = flow.grantedScopes?.join(" ") ?? null;

  for (const channel of channels) {
    const existing = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.provider, provider),
        eq(socialAccounts.platformAccountId, channel.id),
      ),
    });
    const values = {
      credentialId,
      name: channel.title,
      handle: channel.customUrl ?? null,
      avatar: channel.thumbnail ?? null,
      accessToken,
      // Google omits the refresh token on some re-consents; keep the one we had.
      refreshToken: refreshToken ?? existing?.refreshToken ?? null,
      accessTokenExpiresAt: expiresAt,
      scopes,
      status: "active",
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(socialAccounts).set(values).where(eq(socialAccounts.id, existing.id));
    } else {
      await db
        .insert(socialAccounts)
        .values({ id: newId(), userId, provider, platformAccountId: channel.id, ...values });
    }
  }
  return { userId, channels: channels.map((channel) => channel.title) };
}

export async function listAccounts(userId: string) {
  const rows = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.userId, userId),
    orderBy: [asc(socialAccounts.createdAt)],
  });
  return rows.map(({ accessToken: _a, refreshToken: _r, ...row }) => row);
}

export async function deleteAccount(userId: string, id: string) {
  await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.id, id), eq(socialAccounts.userId, userId)));
}

/**
 * A usable access token for the account, refreshed and saved when it is close to expiry.
 * A refresh the platform refuses marks the account for reconnection.
 */
export async function accessTokenFor(
  account: SocialAccount,
  credential: ProviderCredential,
): Promise<string> {
  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > TOKEN_REFRESH_MARGIN) return decrypt(account.accessToken);

  if (!account.refreshToken) {
    await db
      .update(socialAccounts)
      .set({ status: "reconnect", updatedAt: new Date() })
      .where(eq(socialAccounts.id, account.id));
    throw new ServiceError("The account has no refresh token — reconnect it", 409);
  }

  const provider = getProvider(account.provider);
  if (!provider.refreshToken) throw new ServiceError(`${provider.name} tokens cannot be refreshed`);
  try {
    const refreshed = await provider.refreshToken(
      await decrypt(account.refreshToken),
      credential.clientId,
      await decrypt(credential.clientSecret),
    );
    await db
      .update(socialAccounts)
      .set({
        accessToken: await encrypt(refreshed.accessToken),
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, account.id));
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof Error && error.message === "RECONNECT_REQUIRED") {
      await db
        .update(socialAccounts)
        .set({ status: "reconnect", updatedAt: new Date() })
        .where(eq(socialAccounts.id, account.id));
      throw new ServiceError("Access was revoked or expired — reconnect the account", 409);
    }
    throw error;
  }
}

// ── posts ──────────────────────────────────────────────────────────────────────

export type CreatePostInput = {
  accountId: string;
  mediaUrl: string;
  caption?: string;
  /**
   * ISO time the post goes live. Omitted means "post now": it goes live once the lead time
   * has passed, which is when the platform has finished processing it.
   */
  scheduledAt?: string;
  /** Minutes before go-live that the post is uploaded; defaults per platform (YouTube 30). */
  leadMinutes?: number;
  metadata?: Partial<PlatformMetadata>;
};

function checkMedia(userId: string, url: string): string {
  const mediaUrl = url.trim();
  if (!/^(https:\/\/|r2:\/\/)/.test(mediaUrl))
    throw new ServiceError("Media must be an https:// URL or an uploaded file");
  // A file in our bucket must be one this user uploaded (keys live under media/<userId>/).
  if (mediaUrl.startsWith("r2://") && !mediaUrl.startsWith(`r2://media/${userId}/`)) {
    throw new ServiceError("That uploaded file belongs to someone else", 403);
  }
  return mediaUrl;
}

/** The go-live time: the one asked for, or — for "post now" — once the lead has passed. */
function checkTime(value: string | undefined, leadMinutes: number): Date {
  const date = value ? new Date(value) : new Date(Date.now() + leadMinutes * 60_000);
  if (Number.isNaN(date.getTime())) throw new ServiceError("scheduledAt is not a valid date");
  return date;
}

function leadFor(provider: string, value: unknown): number {
  const platform = getProvider(provider);
  try {
    return platform.schedulesNatively ? checkLead(value, platform.defaultLeadMinutes) : 0;
  } catch (error) {
    throw new ServiceError(error instanceof Error ? error.message : "Invalid leadMinutes");
  }
}

function checkMetadata(
  provider: string,
  input: Partial<PlatformMetadata> | undefined,
  caption: string | null | undefined,
): Record<string, JsonValue> {
  const metadata = { ...input } as Record<string, JsonValue>;
  if (provider === "youtube") {
    const title = String(metadata.title ?? caption ?? "").trim();
    if (!title) throw new ServiceError("A YouTube video needs a title");
    if (title.length > 100) throw new ServiceError("YouTube titles are limited to 100 characters");
    metadata.title = title;
    delete metadata.publishAt; // set by the scheduler from scheduledAt
  }
  return metadata;
}

/**
 * Starts a publishing workflow for the post and makes it the post's owner. Only the owner
 * may publish, so an older instance still sleeping toward a previous time exits when it
 * wakes instead of uploading a second copy.
 */
async function dispatch(postId: string, reason?: string) {
  const instanceId = reason ? `${postId}-${reason}-${Date.now()}` : postId;
  await updatePost(postId, { workflowId: instanceId });
  await env.PUBLISH_WORKFLOW.create({ id: instanceId, params: { postId } });
}

async function stopWorkflow(instanceId: string | null) {
  if (!instanceId) return;
  try {
    await (await env.PUBLISH_WORKFLOW.get(instanceId)).terminate();
  } catch {
    // already finished; if it is still waiting, it is no longer the owner and will stop
  }
}

export async function createPost(userId: string, input: CreatePostInput) {
  const account = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, input.accountId), eq(socialAccounts.userId, userId)),
  });
  if (!account) throw new ServiceError("Account not found", 404);
  if (account.status !== "active")
    throw new ServiceError("This account needs to be reconnected first", 409);

  const id = newId();
  const leadMinutes = leadFor(account.provider, input.leadMinutes);
  await db.insert(socialPosts).values({
    id,
    userId,
    accountId: account.id,
    provider: account.provider,
    mediaUrl: checkMedia(userId, input.mediaUrl),
    caption: input.caption ?? null,
    metadata: checkMetadata(account.provider, input.metadata, input.caption),
    scheduledAt: checkTime(input.scheduledAt, leadMinutes),
    leadMinutes,
  });

  // One durable workflow per post: it survives restarts, retries on its own, and sleeps
  // until the scheduled time when the platform cannot hold the post itself.
  await dispatch(id);
  return getPost(userId, id);
}

export type EditPostInput = Partial<Omit<CreatePostInput, "accountId">>;

/**
 * Changes a post that has not gone out yet: its time, media, caption or metadata. The
 * post gets a fresh workflow, so a new time takes effect whether it is sooner or later.
 */
export async function editPost(userId: string, id: string, input: EditPostInput) {
  const post = await getPost(userId, id);
  if (post.status !== "scheduled") {
    throw new ServiceError(
      `A ${post.status} post can no longer be edited here${post.platformUrl ? ` — change it on the platform: ${post.platformUrl}` : ""}`,
      409,
    );
  }

  const caption = input.caption !== undefined ? input.caption : post.caption;
  const leadMinutes =
    input.leadMinutes !== undefined ? leadFor(post.provider, input.leadMinutes) : post.leadMinutes;
  await updatePost(id, {
    leadMinutes,
    ...(input.mediaUrl !== undefined && { mediaUrl: checkMedia(userId, input.mediaUrl) }),
    ...(input.caption !== undefined && { caption: input.caption }),
    ...(input.scheduledAt !== undefined && {
      scheduledAt: checkTime(input.scheduledAt, leadMinutes ?? 0),
    }),
    ...(input.metadata !== undefined && {
      metadata: checkMetadata(
        post.provider,
        { ...(post.metadata as Partial<PlatformMetadata>), ...input.metadata },
        caption,
      ),
    }),
  });
  await stopWorkflow(post.workflowId);
  await dispatch(id, "edit");
  return getPost(userId, id);
}

export async function getPost(userId: string, id: string) {
  const post = await db.query.socialPosts.findFirst({
    where: and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)),
  });
  if (!post) throw new ServiceError("Post not found", 404);
  return post;
}

export async function listPosts(
  userId: string,
  filter: { status?: string[]; from?: Date; to?: Date; limit?: number } = {},
) {
  const conditions = [eq(socialPosts.userId, userId)];
  if (filter.status?.length) conditions.push(inArray(socialPosts.status, filter.status));
  if (filter.from) conditions.push(gte(socialPosts.scheduledAt, filter.from));
  if (filter.to) conditions.push(lte(socialPosts.scheduledAt, filter.to));
  return db.query.socialPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(socialPosts.scheduledAt)],
    limit: Math.min(filter.limit ?? 100, 500),
  });
}

/** Stops a post that has not been published; its workflow sees the status and ends. */
export async function cancelPost(userId: string, id: string) {
  const post = await getPost(userId, id);
  if (post.status !== "scheduled")
    throw new ServiceError(`A ${post.status} post cannot be cancelled`, 409);
  await db
    .update(socialPosts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.status, "scheduled")));
  await stopWorkflow(post.workflowId ?? id);
  return getPost(userId, id);
}

/** Sends a failed post again, now or at its original time if that is still ahead. */
export async function retryPost(userId: string, id: string) {
  const post = await getPost(userId, id);
  if (post.status !== "failed") throw new ServiceError("Only a failed post can be retried", 409);
  const scheduledAt = post.scheduledAt.getTime() > Date.now() ? post.scheduledAt : new Date();
  await updatePost(id, { status: "scheduled", scheduledAt, error: null });
  await dispatch(id, "retry");
  return getPost(userId, id);
}

/**
 * A post together with what the platform says about it now: whether it is processed,
 * public, scheduled, locked or rejected, and its view, like and comment counts.
 */
export async function postInsights(userId: string, id: string) {
  const post = await getPost(userId, id);
  if (!post.platformPostId) return { post, platform: null, metrics: null };

  const loaded = await loadForPublishing(id);
  if (!loaded) return { post, platform: null, metrics: null };
  const provider = getProvider(post.provider);
  const token = await accessTokenFor(loaded.account, loaded.credential);
  const [platform, metrics] = await Promise.all([
    provider.fetchStatus?.(post.platformPostId, token) ?? null,
    provider.fetchAnalytics?.(post.platformPostId, token, loaded.account.platformAccountId) ?? null,
  ]);
  return { post, platform, metrics: metrics ? { ...metrics, raw: undefined } : null };
}

/**
 * Sets (or replaces) the custom thumbnail of a post that is already on the platform, and
 * remembers the URL in its metadata. A post still waiting in mixetape takes the thumbnail
 * through metadata.thumbnailUrl instead (update_post), and gets it right after upload.
 */
export async function setPostThumbnail(userId: string, id: string, imageUrl: string) {
  const post = await getPost(userId, id);
  if (!(imageUrl ?? "").startsWith("https://"))
    throw new ServiceError("imageUrl must be a public https URL");
  if (!post.platformPostId) {
    throw new ServiceError(
      "This post is not on the platform yet — set metadata.thumbnailUrl with update_post instead",
      409,
    );
  }
  const provider = getProvider(post.provider);
  if (!provider.setThumbnail)
    throw new ServiceError(`${provider.name} does not support custom thumbnails`, 409);
  const loaded = await loadForPublishing(id);
  if (!loaded) throw new ServiceError("The post's account or credential is gone", 409);
  const token = await accessTokenFor(loaded.account, loaded.credential);
  await provider.setThumbnail(post.platformPostId, imageUrl, token);
  await updatePost(id, { metadata: { ...post.metadata, thumbnailUrl: imageUrl } });
  return getPost(userId, id);
}

/** What the platform says about a post now, for the workflow's go-live check. */
export async function platformStatusFor(postId: string) {
  const loaded = await loadForPublishing(postId);
  if (!loaded?.post.platformPostId) return null;
  const provider = getProvider(loaded.post.provider);
  if (!provider.fetchStatus) return null;
  const token = await accessTokenFor(loaded.account, loaded.credential);
  return provider.fetchStatus(loaded.post.platformPostId, token);
}

/** Everything the workflow needs to publish one post. */
export async function loadForPublishing(postId: string): Promise<{
  post: SocialPost;
  account: SocialAccount;
  credential: ProviderCredential;
} | null> {
  const post = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, postId) });
  if (!post) return null;
  const account = await db.query.socialAccounts.findFirst({
    where: eq(socialAccounts.id, post.accountId),
  });
  if (!account) return null;
  const credential = await db.query.providerCredentials.findFirst({
    where: eq(providerCredentials.id, account.credentialId),
  });
  if (!credential) return null;
  return { post, account, credential };
}

export async function updatePost(id: string, values: Partial<typeof socialPosts.$inferInsert>) {
  await db
    .update(socialPosts)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(socialPosts.id, id));
}

// ── API keys ───────────────────────────────────────────────────────────────────

const KEY_PREFIX = "mxt_";

export async function createApiKey(userId: string, name: string) {
  const key = `${KEY_PREFIX}${randomToken(32)}`;
  const id = newId();
  await db.insert(apiKeys).values({
    id,
    userId,
    name: name.trim() || "API key",
    prefix: key.slice(0, KEY_PREFIX.length + 6),
    hash: await sha256(key),
  });
  // The only time the full key exists outside the caller's hands.
  return { id, key };
}

export async function listApiKeys(userId: string) {
  const rows = await db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, userId),
    orderBy: [desc(apiKeys.createdAt)],
  });
  return rows.map(({ hash: _hash, ...row }) => row);
}

export async function deleteApiKey(userId: string, id: string) {
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

/** The user a `Authorization: Bearer mxt_…` header belongs to, or null. */
export async function userForApiKey(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(KEY_PREFIX)) return null;
  const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.hash, await sha256(key)) });
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row.userId;
}
