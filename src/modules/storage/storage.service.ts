import { env } from "cloudflare:workers";

/**
 * R2 media access, with the ownership rule in one place: every file sits in its owner's
 * folder, media/<userId>/…, and nothing is deleted outside it. Handlers must not call
 * `env.BUCKET.delete` directly.
 */

export const MEDIA_PREFIX = "media/";

/**
 * Deletes one file from a user's folder (media/<userId>/…). Returns false when there was
 * nothing to delete.
 */
export async function deleteUserFile(userId: string, key: string): Promise<boolean> {
  if (!key.startsWith(`${MEDIA_PREFIX}${userId}/`)) return false;
  const head = await env.BUCKET.head(key);
  if (!head) return false;
  await env.BUCKET.delete(key);
  return true;
}
