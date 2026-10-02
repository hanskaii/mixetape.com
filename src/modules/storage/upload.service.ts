import { env } from "cloudflare:workers";
import { ServiceError } from "#/modules/api/errors";
import { requiredSecret } from "#/modules/secrets/secrets.service";
import { presignUrl } from "./presign";
import { MEDIA_PREFIX } from "./storage.service";

/**
 * Getting files into mixetape's bucket, for people and agents alike.
 *
 *   createUpload  → a presigned URL: one PUT of the file goes straight to R2 (up to 5 GB),
 *                   never through the Worker and its 100 MB request limit
 *   importFromUrl → mixetape copies a file that is already on the web
 *
 * Either way the file has an `r2://` URL (read by mixetape through its binding) and a
 * public one on media.mixetape.com, for services outside mixetape. Ownership is its place
 * in the bucket: every key sits under media/<userId>/.
 */

const MAX_SIZE = 5 * 1024 * 1024 * 1024; // R2's limit for a single PUT
const UPLOAD_TTL = 6 * 60 * 60; // seconds — long enough for a slow connection

export type StoredFile = {
  url: string;
  publicUrl: string;
  key: string;
  size: number;
  contentType: string;
};

const r2Url = (key: string) => `r2://${key}`;

/** Where anyone can fetch the file, through the bucket's custom domain. */
export const publicUrl = (key: string) =>
  `${env.MEDIA_PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** A file's place in the bucket: under the owner's folder, which is how ownership is proven. */
function newKey(userId: string, fileName: string, prefix = MEDIA_PREFIX): string {
  const name = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-120) || "file";
  return `${prefix}${userId}/${Date.now()}-${name}`;
}

/** The bucket key of an `r2://` URL or a bare key, if it is the user's. */
export function ownKey(userId: string, urlOrKey: string): string {
  const key = urlOrKey.startsWith("r2://") ? urlOrKey.slice("r2://".length) : urlOrKey;
  if (!key.startsWith(`${MEDIA_PREFIX}${userId}/`))
    throw new ServiceError("That file is not yours", 403);
  return key;
}

// ── presigned upload ─────────────────────────────────────────────────────────

/**
 * `prefix` puts the file outside the media folder — avatars/, which the library neither lists
 * nor expires.
 */
export async function createUpload(
  userId: string,
  input: { fileName: string; contentType?: string; size?: number },
  prefix = MEDIA_PREFIX,
) {
  if (input.size !== undefined && input.size > MAX_SIZE)
    throw new ServiceError("One upload is limited to 5 GB");
  const contentType = input.contentType?.trim() || "application/octet-stream";
  const key = newKey(userId, input.fileName, prefix);
  const [accessKeyId, secretAccessKey] = await Promise.all([
    requiredSecret("R2_ACCESS_KEY_ID"),
    requiredSecret("R2_SECRET_ACCESS_KEY"),
  ]);
  const uploadUrl = await presignUrl({
    method: "PUT",
    host: `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    path: `/${env.R2_BUCKET_NAME}/${key}`,
    accessKeyId,
    secretAccessKey,
    expiresIn: UPLOAD_TTL,
    // Signed, so the stored file gets the right type; the PUT must send exactly this.
    headers: { "content-type": contentType },
  });
  return {
    url: r2Url(key),
    publicUrl: publicUrl(key),
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": contentType },
    expiresAt: new Date(Date.now() + UPLOAD_TTL * 1000).toISOString(),
    curl: `curl -sS --fail-with-body -X PUT -H "Content-Type: ${contentType}" -T <file> "${uploadUrl}"`,
  };
}

// ── import from a URL ────────────────────────────────────────────────────────

/** Copies a file from a public https URL into the bucket, streamed, up to 5 GB. */
export async function importFromUrl(
  userId: string,
  input: { url: string; fileName?: string },
): Promise<StoredFile> {
  if (!input.url.startsWith("https://")) throw new ServiceError("url must be a public https URL");
  const res = await fetch(input.url);
  if (!res.ok || !res.body)
    throw new ServiceError(`The file could not be fetched (${res.status})`, 502, {
      code: "source_unreachable",
      field: "url",
    });
  const size = Number(res.headers.get("content-length") ?? 0);
  if (!size)
    throw new ServiceError(
      "The server did not say how large the file is (no Content-Length) — upload the file instead",
    );
  if (size > MAX_SIZE)
    throw new ServiceError("Imports are limited to 5 GB — upload the file instead");

  const contentType = res.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  const fileName =
    input.fileName || decodeURIComponent(new URL(input.url).pathname.split("/").pop() || "file");
  const key = newKey(userId, fileName);
  // R2 needs to know the length of a streamed body up front.
  const { readable, writable } = new FixedLengthStream(size);
  const [object] = await Promise.all([
    env.BUCKET.put(key, readable, {
      httpMetadata: { contentType },
      customMetadata: { userId, originalName: fileName, source: input.url },
    }),
    res.body.pipeTo(writable),
  ]);
  if (!object) throw new ServiceError("Storage refused the file", 502);
  return { url: r2Url(key), publicUrl: publicUrl(key), key, size: object.size, contentType };
}
