import { env } from "cloudflare:workers";

/**
 * R2 media access, with the ownership rule in one place.
 *
 * Uploads stamp `customMetadata.userId`; every mutation checks it. Handlers must
 * not call `env.BUCKET.delete` directly — a second inline copy of this logic is
 * how the unauthorized-delete bug survived its first fix.
 */

export const MEDIA_PREFIX = "media/";

export interface MediaObject {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
}

export interface DeleteMediaResult {
  deleted: number;
  refused: number;
}

/**
 * Media the user may see. Objects predating ownership metadata have no recorded
 * owner and stay visible, so existing media does not appear to vanish.
 */
export async function listOwnedMedia(
  userId: string,
  subPrefix = "",
  limit = 100,
): Promise<MediaObject[]> {
  if (!env.BUCKET) return [];

  const list = await env.BUCKET.list({
    prefix: `${MEDIA_PREFIX}${subPrefix}`,
    limit,
    include: ["customMetadata"],
  });

  return list.objects
    .filter((obj) => {
      const owner = obj.customMetadata?.userId;
      return !owner || owner === userId;
    })
    .map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      httpMetadata: obj.httpMetadata,
    }));
}

/**
 * Delete only the keys the user owns. Returns counts rather than throwing on a
 * partial refusal, so a mixed batch does not lose its successful deletes.
 */
export async function deleteOwnedMedia(keys: string[], userId: string): Promise<DeleteMediaResult> {
  if (!env.BUCKET) return { deleted: 0, refused: keys.length };
  if (!keys.length) return { deleted: 0, refused: 0 };

  const owned = await Promise.all(
    keys.map(async (key) => {
      const head = await env.BUCKET.head(key);
      // An object with no recorded owner predates ownership metadata. Refuse
      // rather than allow an irreversible delete.
      return head?.customMetadata?.userId === userId ? key : null;
    }),
  );

  const deletable = owned.filter((key): key is string => key !== null);
  await Promise.all(deletable.map((key) => env.BUCKET.delete(key)));

  return { deleted: deletable.length, refused: keys.length - deletable.length };
}
