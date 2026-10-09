import { env } from "cloudflare:workers";
import { sha256 } from "#/modules/secrets/crypto";
import { publicUrl } from "./upload.service";

/**
 * A connected channel's picture, kept in mixetape's own storage. Platforms hand out picture
 * links that stop working (Facebook, Instagram and Threads sign theirs and let them expire),
 * so the picture is copied when the channel is connected, and the channel shows ours.
 * It lives under avatars/<user>/, which Media & Storage never lists and never expires, and
 * which goes with the account when it is deleted.
 */

const hex = (digest: ArrayBuffer) =>
  [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * The link the channel should show for `source`: our copy, or `source` itself when it cannot
 * be copied (the platform did not answer, the file is not a picture or is too large), so a
 * hiccup never leaves a channel without its picture.
 */
export async function keepChannelAvatar(
  userId: string,
  provider: string,
  platformAccountId: string,
  source: string | null | undefined,
): Promise<string | null> {
  if (!source) return null;
  const own = publicUrl(`avatars/${userId}/`);
  if (source.startsWith(own)) return source;
  if (!source.startsWith("https://")) return source;
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
    const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const extension = TYPES[type];
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !extension || declared > MAX_BYTES) return source;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return source;
    // The picture's own hash is in the name: a new picture is a new link (no stale cache),
    // and the same one saved again is the same file.
    const [channel, picture] = await Promise.all([
      sha256(`${provider}:${platformAccountId}`),
      crypto.subtle.digest("SHA-256", bytes).then(hex),
    ]);
    const key = `avatars/${userId}/${provider}-${channel.slice(0, 12)}-${picture.slice(0, 10)}.${extension}`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
    });
    return publicUrl(key);
  } catch {
    return source;
  }
}
