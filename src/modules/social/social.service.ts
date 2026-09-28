import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { db } from "#/database/index";
import {
  mediaFiles,
  socialAccounts,
  socialPosts,
  type SocialAccount,
  type SocialPost,
} from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { contains, decodeCursor, page } from "#/modules/api/cursor";
import { decrypt, encrypt, randomToken } from "#/modules/secrets/crypto";
import { secret, type SecretName } from "#/modules/secrets/secrets.service";
import {
  InvalidInputError,
  ReconnectRequiredError,
  getProvider,
  isProvider,
  type AppCredentials,
  type ConnectedAccount,
  type MediaItem,
  type Metadata,
  type TokenGrant,
} from "./providers";
import { checkFormat, kindFromUrl, type FileFacts } from "./formats";
import { checkLead } from "./timing";

/**
 * mixetape's platform apps, connected accounts and posts. The UI's server functions, the REST API, MCP
 * and the publishing workflow all go through here, so ownership checks and encryption live
 * in exactly one place. Work on posts already on a platform is in platform.service,
 * analytics in analytics.service, API keys in api-keys.service.
 */

const OAUTH_STATE_TTL = 600; // seconds
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // refresh when less than 5 min remain

const newId = () => crypto.randomUUID();

export function siteUrl(): string {
  return (env.SITE_URL || env.BETTER_AUTH_URL || "http://localhost:3001").replace(/\/$/, "");
}

export function redirectUri(provider: string): string {
  return `${siteUrl()}/api/connect/${provider}/callback`;
}

// ── platform apps ────────────────────────────────────────────────────────────
//
// Every channel connects through mixetape's own OAuth app for its platform; the app's client
// id and secret are in the Secrets Store (secrets.service). Instagram has its own app id and
// secret (Instagram Login), separate from the Facebook app's. A platform whose app does not
// exist yet cannot be connected.

const APPS: Partial<Record<string, { id: SecretName; secret: SecretName }>> = {
  youtube: { id: "YOUTUBE_CLIENT_ID", secret: "YOUTUBE_CLIENT_SECRET" },
  facebook: { id: "FACEBOOK_APP_ID", secret: "FACEBOOK_APP_SECRET" },
  instagram: { id: "INSTAGRAM_APP_ID", secret: "INSTAGRAM_APP_SECRET" },
};

async function platformApp(provider: string): Promise<AppCredentials | null> {
  const names = APPS[provider];
  if (!names) return null;
  const [clientId, clientSecret] = await Promise.all([secret(names.id), secret(names.secret)]);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function requiredApp(provider: string): Promise<AppCredentials> {
  const app = await platformApp(provider);
  if (!app) throw new ServiceError(`${getProvider(provider).name} cannot be connected yet`, 503);
  return app;
}

/** The platforms a channel can be connected on right now. */
export async function connectableProviders(): Promise<string[]> {
  const ready = await Promise.all(
    Object.keys(APPS).map(async (provider) => ((await platformApp(provider)) ? provider : null)),
  );
  return ready.filter((provider): provider is string => provider !== null);
}

// ── connecting accounts (OAuth) ────────────────────────────────────────────────

/** Who started a connect attempt: the Channels page, or an agent through connect_channel. */
export type ConnectVia = "workspace" | "agent";

type OAuthState = { userId: string; provider: string; via?: ConnectVia };

/** A channel the consent reached that the user has not connected yet, offered to choose. */
export type ChannelChoice = {
  platformAccountId: string;
  name: string;
  handle?: string;
  avatar?: string;
};

/** What happened to one connect attempt, kept briefly so the page that started it can ask. */
export type ConnectResult =
  | { status: "pending" }
  | { status: "done"; channels: string[] }
  | { status: "choose"; refreshed: string[]; choices: ChannelChoice[] }
  | { status: "error"; error: string };
type StoredResult = Exclude<ConnectResult, { status: "pending" }> & { userId?: string };

/** A consent's new channels, held (encrypted) until the user picks which to add. */
type Pending = {
  userId: string;
  provider: string;
  grant: TokenGrant;
  accounts: ConnectedAccount[];
  at: number;
};

/** The URL to send the user to; the state that proves the callback is ours sits in KV. */
export async function startConnect(userId: string, provider: string): Promise<string> {
  return (await beginConnect(userId, provider)).url;
}

/**
 * Starts connecting a channel and returns the consent URL together with its state, so the
 * page can open the URL in a new tab (or show it to be opened anywhere) and then watch the
 * state until the callback has finished — see connectResult and finishConnect.
 */
export async function beginConnect(
  userId: string,
  provider: string,
  via: ConnectVia = "workspace",
) {
  if (!isProvider(provider)) throw new ServiceError(`Unsupported provider: ${provider}`);
  const app = await requiredApp(provider);
  const state = randomToken(24);
  const payload: OAuthState = { userId, provider, via };
  await env.KIT_CACHE.put(`oauth:state:${state}`, JSON.stringify(payload), {
    expirationTtl: OAUTH_STATE_TTL,
  });
  const url = getProvider(provider).connect.authorizeUrl({
    clientId: app.clientId,
    redirectUri: redirectUri(provider),
    state,
  });
  return { url, state, expiresAt: new Date(Date.now() + OAUTH_STATE_TTL * 1000).toISOString() };
}

/**
 * Completes a connect attempt from the platform's callback and remembers the outcome for
 * ten minutes, so whichever page is waiting on this state learns it — even when the
 * consent screen was opened in another browser.
 */
export async function finishConnect(provider: string, code: string, state: string) {
  const resultKey = `oauth:result:${state}`;
  try {
    const { userId, via, result } = await completeConnect(provider, code, state);
    const stored: StoredResult = { ...result, userId };
    await env.KIT_CACHE.put(resultKey, JSON.stringify(stored), { expirationTtl: OAUTH_STATE_TTL });
    return { ...result, via };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect the account";
    // A second use of the same callback (e.g. a reload) keeps the first result.
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
 * Finishes the OAuth dance. Channels the user already has get their new tokens; a single
 * new channel is added at once; several new ones (a person's Pages, say) are held for the
 * user to choose from — see chooseChannels.
 */
async function completeConnect(
  provider: string,
  code: string,
  state: string,
): Promise<{
  userId: string;
  via: ConnectVia;
  result: Exclude<StoredResult, { status: "error" }>;
}> {
  const key = `oauth:state:${state}`;
  const saved = await env.KIT_CACHE.get(key);
  if (!saved) throw new ServiceError("This sign-in link expired — start connecting again", 400);
  await env.KIT_CACHE.delete(key); // one use only
  const { userId, provider: expected, via = "workspace" } = JSON.parse(saved) as OAuthState;
  if (expected !== provider) throw new ServiceError("Provider mismatch", 400);

  const app = await requiredApp(provider);
  const at = Date.now();
  const { grant, accounts } = await getProvider(provider).connect.exchangeCode(app, {
    code,
    redirectUri: redirectUri(provider),
  });

  const connected = new Set(
    (
      await db.query.socialAccounts.findMany({
        where: and(eq(socialAccounts.userId, userId), eq(socialAccounts.provider, provider)),
        columns: { platformAccountId: true },
      })
    ).map((row) => row.platformAccountId),
  );
  const known = accounts.filter((account) => connected.has(account.platformAccountId));
  const fresh = accounts.filter((account) => !connected.has(account.platformAccountId));

  const refreshed = await saveAccounts(userId, provider, grant, known, at);
  if (fresh.length <= 1) {
    const added = await saveAccounts(userId, provider, grant, fresh, at);
    return { userId, via, result: { status: "done", channels: [...refreshed, ...added] } };
  }

  const pending: Pending = { userId, provider, grant, accounts: fresh, at };
  await env.KIT_CACHE.put(`oauth:pending:${state}`, await encrypt(JSON.stringify(pending)), {
    expirationTtl: OAUTH_STATE_TTL,
  });
  return {
    userId,
    via,
    result: {
      status: "choose",
      refreshed,
      choices: fresh.map(({ platformAccountId, name, handle, avatar }) => ({
        platformAccountId,
        name,
        handle,
        avatar,
      })),
    },
  };
}

/** Adds the channels the user picked from a consent that reached several new ones. */
export async function chooseChannels(userId: string, state: string, platformAccountIds: string[]) {
  const key = `oauth:pending:${state}`;
  const sealed = await env.KIT_CACHE.get(key);
  if (!sealed) throw new ServiceError("This choice expired — connect again", 410);
  const pending = JSON.parse(await decrypt(sealed)) as Pending;
  if (pending.userId !== userId) throw new ServiceError("This choice expired — connect again", 410);
  await env.KIT_CACHE.delete(key);

  const picked = pending.accounts.filter((account) =>
    platformAccountIds.includes(account.platformAccountId),
  );
  const channels = await saveAccounts(userId, pending.provider, pending.grant, picked, pending.at);
  const stored: StoredResult = { status: "done", channels, userId };
  await env.KIT_CACHE.put(`oauth:result:${state}`, JSON.stringify(stored), {
    expirationTtl: OAUTH_STATE_TTL,
  });
  return { channels };
}

/** Stores the accounts with their tokens (updating any already connected); their names. */
async function saveAccounts(
  userId: string,
  provider: string,
  grant: TokenGrant,
  accounts: ConnectedAccount[],
  at: number,
): Promise<string[]> {
  for (const account of accounts) {
    // A Facebook Page has its own token; a YouTube channel shares the consent's.
    const own = account.grant ?? grant;
    const accessToken = await encrypt(own.accessToken);
    const refreshToken = own.refreshToken ? await encrypt(own.refreshToken) : null;
    const expiresAt = new Date(at + own.expiresIn * 1000);
    const scopes = own.scopes.join(" ");
    const existing = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.provider, provider),
        eq(socialAccounts.platformAccountId, account.platformAccountId),
      ),
    });
    const values = {
      name: account.name,
      handle: account.handle ?? null,
      avatar: account.avatar ?? null,
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
      await db.insert(socialAccounts).values({
        id: newId(),
        userId,
        provider,
        platformAccountId: account.platformAccountId,
        ...values,
      });
    }
  }
  return accounts.map((account) => account.name);
}

export async function listAccounts(userId: string) {
  const rows = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.userId, userId),
    orderBy: [asc(socialAccounts.createdAt)],
  });
  // A channel connected before mixetape asked for more permissions must reconnect too.
  return rows.map(({ accessToken: _a, refreshToken: _r, ...row }) => ({
    ...row,
    status: row.status === "active" && missingScopes(row).length ? "reconnect" : row.status,
  }));
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
export async function accessTokenFor(account: SocialAccount): Promise<string> {
  const markReconnect = () =>
    db
      .update(socialAccounts)
      .set({ status: "reconnect", updatedAt: new Date() })
      .where(eq(socialAccounts.id, account.id));
  // Tokens sealed with an earlier encryption key cannot be read: the channel must be
  // connected again, which is what the Reconnect button does.
  const open = (sealed: string) =>
    decrypt(sealed).catch(async () => {
      await markReconnect();
      throw new ServiceError(
        "This channel's saved access can no longer be read — reconnect it",
        409,
      );
    });

  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > TOKEN_REFRESH_MARGIN) return open(account.accessToken);

  if (!account.refreshToken) {
    await markReconnect();
    throw new ServiceError("The account has no refresh token — reconnect it", 409);
  }

  try {
    const refreshed = await getProvider(account.provider).connect.refresh(
      await requiredApp(account.provider),
      await open(account.refreshToken),
    );
    await db
      .update(socialAccounts)
      .set({
        accessToken: await encrypt(refreshed.accessToken),
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
        ...(refreshed.refreshToken && { refreshToken: await encrypt(refreshed.refreshToken) }),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, account.id));
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof ReconnectRequiredError) {
      await markReconnect();
      throw new ServiceError(error.message, 409);
    }
    throw error;
  }
}

/** The permissions the account still has to grant, e.g. after mixetape asked for more. */
export function missingScopes(account: Pick<SocialAccount, "provider" | "scopes">): string[] {
  const granted = (account.scopes ?? "").split(" ");
  return getProvider(account.provider).connect.scopes.filter((scope) => !granted.includes(scope));
}

// ── posts ──────────────────────────────────────────────────────────────────────

export type CreatePostInput = {
  accountId: string;
  /** One file; or `media`, several (a carousel). */
  mediaUrl?: string;
  /** Every file of the post, in order: a carousel or album where the platform takes one. */
  media?: string[];
  caption?: string;
  /**
   * ISO time the post goes live. Omitted means "post now": it goes live once the lead time
   * has passed, which is when the platform has finished processing it.
   */
  scheduledAt?: string;
  /** Minutes before go-live that the post is uploaded; defaults per platform (YouTube 30). */
  leadMinutes?: number;
  /** Platform fields; see the provider's metadata schema. */
  metadata?: Metadata;
  /** The library group the post is published from (library publishing). */
  groupId?: string;
  /** Delete the post's files from storage once it is published (library publishing). */
  cleanup?: boolean;
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

/**
 * A post's files with what is known of each: files in mixetape storage are looked up in the
 * index (kind, type, size, length), anything else is judged by its URL.
 */
export async function resolveMedia(
  userId: string,
  urls: string[],
): Promise<{ media: MediaItem[]; facts: FileFacts[] }> {
  if (!urls.length) throw new ServiceError("Give the post a file: mediaUrl or media");
  if (urls.length > 20) throw new ServiceError("A post takes at most 20 files");
  const checked = urls.map((url) => checkMedia(userId, url));
  const keys = checked.filter((url) => url.startsWith("r2://")).map((url) => url.slice(5));
  const indexed = keys.length
    ? await db.query.mediaFiles.findMany({
        where: and(eq(mediaFiles.userId, userId), inArray(mediaFiles.key, keys)),
      })
    : [];
  const facts = checked.map((url): FileFacts => {
    const file = indexed.find((candidate) => `r2://${candidate.key}` === url);
    if (!file) return { kind: kindFromUrl(url) };
    if (file.status !== "ready")
      throw new ServiceError(`${file.name} is not ready — finish its upload first`, 409);
    return file;
  });
  const media = checked.map((url, index) => ({
    url,
    kind: facts[index].kind === "image" ? ("image" as const) : ("video" as const),
  }));
  return { media, facts };
}

/** Refuses files the platform cannot take as one post. */
function checkPostFormat(provider: string, facts: FileFacts[]) {
  const platform = getProvider(provider);
  const { problems } = checkFormat(platform.name, platform.formats, facts);
  if (problems.length) throw new ServiceError(problems.join("; "));
}

/** A post's files: its `media`, or — for posts from before carousels — its one media URL. */
export function postMedia(post: Pick<SocialPost, "media" | "mediaUrl">): MediaItem[] {
  return post.media?.length
    ? post.media
    : [{ url: post.mediaUrl, kind: kindFromUrl(post.mediaUrl) }];
}

/** The go-live time: the one asked for, or — for "post now" — once the lead has passed. */
function checkTime(value: string | undefined, leadMinutes: number): Date {
  const date = value ? new Date(value) : new Date(Date.now() + leadMinutes * 60_000);
  if (Number.isNaN(date.getTime())) throw new ServiceError("scheduledAt is not a valid date");
  return date;
}

function leadFor(provider: string, value: unknown): number {
  const platform = getProvider(provider);
  let lead: number;
  try {
    lead = platform.schedulesNatively ? checkLead(value, platform.defaultLeadMinutes) : 0;
  } catch (error) {
    throw new ServiceError(error instanceof Error ? error.message : "Invalid leadMinutes");
  }
  const min = platform.minLeadMinutes ?? 0;
  if (lead > 0 && lead < min) {
    throw new ServiceError(
      `${platform.name} needs at least ${min} minutes to schedule: use leadMinutes 0 (upload at go-live) or ${min} or more`,
    );
  }
  return lead;
}

function checkMetadata(
  provider: string,
  input: Metadata | undefined,
  caption: string | null | undefined,
): Metadata {
  try {
    return getProvider(provider).metadata.validate(input ?? {}, caption);
  } catch (error) {
    if (error instanceof InvalidInputError) throw new ServiceError(error.message);
    throw error;
  }
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
  const { media, facts } = await resolveMedia(
    userId,
    input.media ?? (input.mediaUrl ? [input.mediaUrl] : []),
  );
  checkPostFormat(account.provider, facts);
  await db.insert(socialPosts).values({
    id,
    userId,
    accountId: account.id,
    provider: account.provider,
    mediaUrl: media[0].url,
    media,
    groupId: input.groupId ?? null,
    cleanup: input.cleanup ?? false,
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

export type EditPostInput = Partial<Omit<CreatePostInput, "accountId" | "groupId" | "cleanup">>;

/**
 * Changes a post that has not gone out yet: its time, media, caption or metadata. The
 * post gets a fresh workflow, so a new time takes effect whether it is sooner or later.
 */
export async function editPost(userId: string, id: string, input: EditPostInput) {
  const post = await getPost(userId, id);
  if (post.status !== "scheduled") {
    throw new ServiceError(
      `A ${post.status} post is already on the platform — change it with edit_published_post (PATCH /api/v1/posts/:id/platform)`,
      409,
    );
  }

  const caption = input.caption !== undefined ? input.caption : post.caption;
  const leadMinutes =
    input.leadMinutes !== undefined ? leadFor(post.provider, input.leadMinutes) : post.leadMinutes;
  const urls = input.media ?? (input.mediaUrl !== undefined ? [input.mediaUrl] : null);
  let media: MediaItem[] | undefined;
  if (urls) {
    const resolved = await resolveMedia(userId, urls);
    checkPostFormat(post.provider, resolved.facts);
    media = resolved.media;
  }
  await updatePost(id, {
    leadMinutes,
    ...(media && { mediaUrl: media[0].url, media }),
    ...(input.caption !== undefined && { caption: input.caption }),
    ...(input.scheduledAt !== undefined && {
      scheduledAt: checkTime(input.scheduledAt, leadMinutes ?? 0),
    }),
    ...(input.metadata !== undefined && {
      metadata: checkMetadata(post.provider, { ...post.metadata, ...input.metadata }, caption),
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

export type PostFilter = {
  status?: string[];
  /** Only posts on these accounts (mixetape account ids). */
  accountId?: string[];
  /** Only posts on these platforms, e.g. "youtube". */
  provider?: string[];
  /** Only posts published from this library group. */
  groupId?: string;
  /** Words in the title, caption or description (case-insensitive). */
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  /** nextCursor from the previous page. */
  cursor?: string;
};

/** Posts, newest scheduled first, a page at a time: `nextCursor` is null on the last page. */
export async function listPosts(userId: string, filter: PostFilter = {}) {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  for (const [name, date] of [
    ["from", filter.from],
    ["to", filter.to],
  ] as const) {
    if (date && Number.isNaN(date.getTime()))
      throw new ServiceError(`${name} must be an ISO time, e.g. 2026-10-02T00:00:00+07:00`);
  }
  const conditions = [eq(socialPosts.userId, userId)];
  if (filter.status?.length) conditions.push(inArray(socialPosts.status, filter.status));
  if (filter.accountId?.length) conditions.push(inArray(socialPosts.accountId, filter.accountId));
  if (filter.provider?.length) conditions.push(inArray(socialPosts.provider, filter.provider));
  if (filter.groupId) conditions.push(eq(socialPosts.groupId, filter.groupId));
  if (filter.from) conditions.push(gte(socialPosts.scheduledAt, filter.from));
  if (filter.to) conditions.push(lte(socialPosts.scheduledAt, filter.to));
  const search = filter.search?.trim();
  if (search) {
    conditions.push(
      or(
        contains(socialPosts.caption, search),
        contains(sql`json_extract(${socialPosts.metadata}, '$.title')`, search),
        contains(sql`json_extract(${socialPosts.metadata}, '$.description')`, search),
      )!,
    );
  }
  if (filter.cursor) {
    const after = decodeCursor(filter.cursor);
    conditions.push(
      or(
        lt(socialPosts.scheduledAt, after.at),
        and(eq(socialPosts.scheduledAt, after.at), lt(socialPosts.id, after.id)),
      )!,
    );
  }
  // One more than a page, to know whether another follows.
  const rows = await db.query.socialPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(socialPosts.scheduledAt), desc(socialPosts.id)],
    limit: limit + 1,
  });
  const { items: posts, nextCursor } = page(rows, limit, (post) => ({
    at: post.scheduledAt,
    id: post.id,
  }));
  return { posts, nextCursor };
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

/** What the platform says about a post now, for the workflow's go-live check. */
export async function platformStatusFor(postId: string) {
  const loaded = await loadForPublishing(postId);
  if (!loaded?.post.platformPostId) return null;
  const status = getProvider(loaded.post.provider).status;
  if (!status) return null;
  const token = await accessTokenFor(loaded.account);
  return status.fetch(loaded.post.platformPostId, token);
}

/** An account the user owns. */
export async function loadAccount(userId: string, accountId: string) {
  const account = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, accountId), eq(socialAccounts.userId, userId)),
  });
  if (!account) throw new ServiceError("Account not found", 404);
  return account;
}

/** Everything the workflow needs to publish one post. */
export async function loadForPublishing(postId: string): Promise<{
  post: SocialPost;
  account: SocialAccount;
} | null> {
  const post = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, postId) });
  if (!post) return null;
  const account = await db.query.socialAccounts.findFirst({
    where: eq(socialAccounts.id, post.accountId),
  });
  if (!account) return null;
  return { post, account };
}

export async function updatePost(id: string, values: Partial<typeof socialPosts.$inferInsert>) {
  await db
    .update(socialPosts)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(socialPosts.id, id));
}
