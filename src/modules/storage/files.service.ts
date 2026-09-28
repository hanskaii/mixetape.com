import { env } from "cloudflare:workers";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "#/database/index";
import { libraryItemFiles, mediaFiles, socialPosts, type MediaFile } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { containing, decodeCursor, page } from "#/modules/api/cursor";
import { probe, type Probe } from "./probe";
import { deleteUserFile } from "./storage.service";
import * as uploads from "./upload.service";

/**
 * The files in a user's storage, indexed in D1 with what was read from each file (kind, size
 * in pixels, duration) — so lists and searches are indexed queries, and whatever schedules a
 * file can know what it is without trusting a caller. The bytes stay in R2; this only knows
 * about them.
 *
 * An upload is a row from `createFileUpload` (status 'uploading') until `finishUpload` has
 * found the file in R2 and read it ('ready'). Uploads never finished go after a day.
 */

const STALE_UPLOAD = 24 * 60 * 60 * 1000;

export type FileView = ReturnType<typeof fileView>;

export function fileView(file: MediaFile) {
  const orientation =
    file.width && file.height
      ? file.width === file.height
        ? "square"
        : file.height > file.width
          ? "vertical"
          : "horizontal"
      : null;
  return {
    id: file.id,
    url: `r2://${file.key}`,
    publicUrl: uploads.publicUrl(file.key),
    name: file.name,
    kind: file.kind,
    contentType: file.contentType,
    size: file.size,
    width: file.width,
    height: file.height,
    durationMs: file.durationMs,
    orientation,
    status: file.status,
    createdAt: file.createdAt,
  };
}

const kindOf = (contentType: string): Probe["kind"] =>
  contentType.startsWith("video/") ? "video" : contentType.startsWith("image/") ? "image" : "other";

/** Reads a stored object's header and records what it is; marks the row ready. */
async function inspect(file: MediaFile) {
  const head = await env.BUCKET.head(file.key);
  if (!head) return null;
  const contentType = head.httpMetadata?.contentType || file.contentType;
  const found: Probe = await probe(contentType, head.size, async (offset, length) => {
    const part = await env.BUCKET.get(file.key, { range: { offset, length } });
    return new Uint8Array(part ? await part.arrayBuffer() : new ArrayBuffer(0));
  }).catch(() => ({ kind: kindOf(contentType) }));
  const values = {
    size: head.size,
    contentType,
    kind: found.kind,
    width: found.width ?? null,
    height: found.height ?? null,
    durationMs: found.durationMs ?? null,
    status: "ready",
  };
  await db.update(mediaFiles).set(values).where(eq(mediaFiles.id, file.id));
  return { ...file, ...values };
}

/** Uploads started more than a day ago and never finished: the row, and any bytes. */
async function dropStaleUploads(userId: string) {
  const stale = await db.query.mediaFiles.findMany({
    where: and(
      eq(mediaFiles.userId, userId),
      eq(mediaFiles.status, "uploading"),
      lt(mediaFiles.createdAt, new Date(Date.now() - STALE_UPLOAD)),
    ),
  });
  for (const file of stale) {
    await deleteUserFile(userId, file.key);
    await db.delete(mediaFiles).where(eq(mediaFiles.id, file.id));
  }
}

/** A presigned upload, and the file it will become once finishUpload is called. */
export async function createFileUpload(
  userId: string,
  input: { fileName: string; contentType?: string; size?: number },
) {
  await dropStaleUploads(userId);
  const upload = await uploads.createUpload(userId, input);
  const contentType = upload.headers["Content-Type"];
  const id = crypto.randomUUID();
  await db.insert(mediaFiles).values({
    id,
    userId,
    key: upload.url.slice("r2://".length),
    name: input.fileName.trim() || "file",
    kind: kindOf(contentType),
    contentType,
    size: input.size ?? 0,
  });
  return { fileId: id, ...upload };
}

async function ownedFile(userId: string, idOrUrl: string): Promise<MediaFile> {
  const key = idOrUrl.startsWith("r2://") ? idOrUrl.slice("r2://".length) : null;
  const file = await db.query.mediaFiles.findFirst({
    where: and(
      eq(mediaFiles.userId, userId),
      key ? eq(mediaFiles.key, key) : eq(mediaFiles.id, idOrUrl),
    ),
  });
  if (!file) throw new ServiceError("File not found", 404);
  return file;
}

/** Checks the uploaded file in R2 and reads what it is. Safe to call again. */
export async function finishUpload(userId: string, fileId: string) {
  const file = await ownedFile(userId, fileId);
  if (file.status === "ready") return fileView(file);
  const inspected = await inspect(file);
  if (!inspected)
    throw new ServiceError(
      "The file has not arrived — PUT it to uploadUrl first, then finish the upload",
      409,
    );
  return fileView(inspected);
}

/** Copies a file from the web into storage, and records it ready. */
export async function importFile(userId: string, input: { url: string; fileName?: string }) {
  const stored = await uploads.importFromUrl(userId, input);
  const id = crypto.randomUUID();
  const row = {
    id,
    userId,
    key: stored.key,
    name:
      input.fileName || decodeURIComponent(new URL(input.url).pathname.split("/").pop() || "file"),
    kind: kindOf(stored.contentType),
    contentType: stored.contentType,
    size: stored.size,
    createdAt: new Date(),
  };
  await db.insert(mediaFiles).values(row);
  const inspected = await inspect({
    ...row,
    width: null,
    height: null,
    durationMs: null,
    status: "uploading",
  });
  return fileView(
    inspected ?? { ...row, width: null, height: null, durationMs: null, status: "failed" },
  );
}

export async function getFile(userId: string, idOrUrl: string) {
  return fileView(await ownedFile(userId, idOrUrl));
}

/** Ready files, newest first, a page at a time; narrowed by kind and words in the name. */
export async function listFiles(
  userId: string,
  filter: { search?: string; kind?: string[]; limit?: number; cursor?: string } = {},
) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 1000);
  const conditions = [eq(mediaFiles.userId, userId), eq(mediaFiles.status, "ready")];
  if (filter.kind?.length) conditions.push(inArray(mediaFiles.kind, filter.kind));
  const search = filter.search?.trim();
  if (search)
    conditions.push(sql`lower(${mediaFiles.name}) like ${containing(search)} escape '\\'`);
  if (filter.cursor) {
    const after = decodeCursor(filter.cursor);
    conditions.push(
      or(
        lt(mediaFiles.createdAt, after.at),
        and(eq(mediaFiles.createdAt, after.at), lt(mediaFiles.id, after.id)),
      )!,
    );
  }
  const rows = await db.query.mediaFiles.findMany({
    where: and(...conditions),
    orderBy: [desc(mediaFiles.createdAt), desc(mediaFiles.id)],
    limit: limit + 1,
  });
  const { items, nextCursor } = page(rows, limit, (file) => ({ at: file.createdAt, id: file.id }));
  return { files: items.map(fileView), nextCursor };
}

/**
 * Deletes a file, unless something still needs it: a content item that holds it, or a post
 * that has not gone out yet. A file mixetape never indexed (stored before the index) goes
 * straight from R2.
 */
export async function deleteFile(userId: string, idOrUrl: string) {
  const file = await ownedFile(userId, idOrUrl).catch(() => null);
  if (!file) {
    if (!idOrUrl.startsWith("r2://")) throw new ServiceError("File not found", 404);
    const key = uploads.ownKey(userId, idOrUrl);
    if (!(await deleteUserFile(userId, key))) throw new ServiceError("File not found", 404);
    return { deleted: true, url: `r2://${key}` };
  }
  const [inItems, pending] = await Promise.all([
    db.query.libraryItemFiles.findMany({ where: eq(libraryItemFiles.fileId, file.id) }),
    db.query.socialPosts.findMany({
      where: and(
        eq(socialPosts.userId, userId),
        eq(socialPosts.mediaUrl, `r2://${file.key}`),
        inArray(socialPosts.status, ["scheduled", "publishing"]),
      ),
      columns: { id: true },
    }),
  ]);
  if (inItems.length || pending.length) {
    const reasons = [
      inItems.length && `${inItems.length} content item${inItems.length > 1 ? "s" : ""}`,
      pending.length && `${pending.length} post${pending.length > 1 ? "s" : ""} not yet sent`,
    ].filter(Boolean);
    throw new ServiceError(`The file is still used by ${reasons.join(" and ")}`, 409);
  }
  await deleteUserFile(userId, file.key);
  await db.delete(mediaFiles).where(eq(mediaFiles.id, file.id));
  return { deleted: true, url: `r2://${file.key}` };
}
