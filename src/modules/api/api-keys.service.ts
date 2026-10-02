import { and, desc, eq } from "drizzle-orm";
import { db } from "#/database/index";
import { apiKeys } from "#/database/schema";
import { randomToken, sha256 } from "#/modules/secrets/crypto";
import { ServiceError } from "./errors";

/**
 * API keys for agents and scripts. Each key carries permissions, so an agent gets only
 * what its job needs — a publishing pipeline need not be able to answer comments.
 */

export const API_SCOPES = {
  read: "See channels, posts, their status, playlists and captions",
  publish: "Schedule, change, cancel and retry posts, and set thumbnails",
  manage: "Edit videos already on the platform, manage playlists and upload captions",
  comments: "Read, post, reply to and moderate comments",
  analytics: "Read post and channel analytics",
  storage: "Upload, import, list and delete files in mixetape's storage",
  channels: "Start connecting channels (you still approve each one on the platform)",
  library:
    "Make, change and read groups in the library (files that go out together, with drafted words)",
  webhooks: "Add, change and remove webhooks that are told when posts and channels change",
} as const;

export type ApiScope = keyof typeof API_SCOPES;
export const ALL_SCOPES = Object.keys(API_SCOPES) as ApiScope[];

/** Who is calling and what they may do. A signed-in person may do everything. */
export type Caller = { userId: string; scopes: readonly ApiScope[] };

export const isScope = (value: string): value is ApiScope => value in API_SCOPES;

const KEY_PREFIX = "mxt_";

export async function createApiKey(userId: string, name: string, scopes: string[]) {
  const granted = [...new Set(scopes)].filter(isScope);
  if (!granted.length) throw new ServiceError("Give the key at least one permission");
  const key = `${KEY_PREFIX}${randomToken(32)}`;
  const id = crypto.randomUUID();
  await db.insert(apiKeys).values({
    id,
    userId,
    name: name.trim() || "API key",
    prefix: key.slice(0, KEY_PREFIX.length + 6),
    hash: await sha256(key),
    scopes: granted,
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

/** The caller behind an `Authorization: Bearer mxt_…` header, or null. */
export async function callerForApiKey(request: Request): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(KEY_PREFIX)) return null;
  const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.hash, await sha256(key)) });
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { userId: row.userId, scopes: row.scopes.filter(isScope) };
}

/** Refuses a caller without the permission, naming it so the key can be fixed. */
export function requireScope(caller: Caller, scope: ApiScope) {
  if (!caller.scopes.includes(scope)) {
    throw new ServiceError(
      `This API key or connected app does not have the "${scope}" permission (${API_SCOPES[scope].toLowerCase()}). Give it that permission on /api-keys: a new key, or connect the app again.`,
      403,
      { code: "missing_permission" },
    );
  }
}
