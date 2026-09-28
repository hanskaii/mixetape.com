import { env } from "cloudflare:workers";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "#/database/index";
import {
  mediaFiles,
  mediaGroupFiles,
  mediaGroups,
  socialPosts,
  type MediaFile,
} from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { contains, decodeCursor, page } from "#/modules/api/cursor";
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
 *
 * Storage is a staging area, not an archive: a file goes once the posts published from the
 * library with it are out (`cleanUpAfterPublish`), and every file goes 30 days after it was
 * stored (`expireFiles`, daily) — never while a post that has not gone out still needs it.
 */

const STALE_UPLOAD = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = 30;
const RETENTION = RETENTION_DAYS * 24 * 60 * 60 * 1000;
/** Posts that still need their files: not out yet, or failed and waiting for a retry. */
const NEEDS_FILES = ["scheduled", "publishing", "uploaded", "failed"];

export type FileView = ReturnType<typeof fileView>;

export function fileView(file: MediaFile, groupId: string | null = null) {
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
    /** The group the file is in, if any. */
    groupId,
    createdAt: file.createdAt,
    /** When storage deletes it, if nothing still needs it then. */
    expiresAt: new Date(file.createdAt.getTime() + RETENTION),
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

/** Puts a new file at the end of a group of the user's. */
async function joinGroup(userId: string, groupId: string, fileId: string) {
  const group = await db.query.mediaGroups.findFirst({
    where: and(eq(mediaGroups.id, groupId), eq(mediaGroups.userId, userId)),
  });
  if (!group) throw new ServiceError("Group not found", 404);
  const links = await db.query.mediaGroupFiles.findMany({
    where: eq(mediaGroupFiles.groupId, groupId),
  });
  const position = links.reduce((max, link) => Math.max(max, link.position + 1), 0);
  await db.insert(mediaGroupFiles).values({ groupId, fileId, position });
}

async function checkGroup(userId: string, groupId: string | undefined) {
  if (!groupId) return;
  const group = await db.query.mediaGroups.findFirst({
    where: and(eq(mediaGroups.id, groupId), eq(mediaGroups.userId, userId)),
  });
  if (!group) throw new ServiceError("Group not found", 404);
}

/**
 * A presigned upload, and the file it will become once finishUpload is called — in a group
 * already, when one is given.
 */
export async function createFileUpload(
  userId: string,
  input: { fileName: string; contentType?: string; size?: number; groupId?: string },
) {
  await checkGroup(userId, input.groupId);
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
  if (input.groupId) await joinGroup(userId, input.groupId, id);
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

const groupOf = async (fileId: string) =>
  (await db.query.mediaGroupFiles.findFirst({ where: eq(mediaGroupFiles.fileId, fileId) }))
    ?.groupId ?? null;

/** Checks the uploaded file in R2 and reads what it is. Safe to call again. */
export async function finishUpload(userId: string, fileId: string) {
  const file = await ownedFile(userId, fileId);
  if (file.status === "ready") return fileView(file, await groupOf(file.id));
  const inspected = await inspect(file);
  if (!inspected)
    throw new ServiceError(
      "The file has not arrived — PUT it to uploadUrl first, then finish the upload",
      409,
    );
  return fileView(inspected, await groupOf(file.id));
}

/** Copies a file from the web into storage — into a group, when one is given — ready. */
export async function importFile(
  userId: string,
  input: { url: string; fileName?: string; groupId?: string },
) {
  await checkGroup(userId, input.groupId);
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
  if (input.groupId) await joinGroup(userId, input.groupId, id);
  const inspected = await inspect({
    ...row,
    width: null,
    height: null,
    durationMs: null,
    status: "uploading",
  });
  return fileView(
    inspected ?? { ...row, width: null, height: null, durationMs: null, status: "failed" },
    input.groupId ?? null,
  );
}

export async function getFile(userId: string, idOrUrl: string) {
  const file = await ownedFile(userId, idOrUrl);
  return fileView(file, await groupOf(file.id));
}

/**
 * Ready files, newest first, a page at a time; narrowed by kind, words in the name, and
 * the group they are in (`loose`: in none).
 */
export async function listFiles(
  userId: string,
  filter: {
    search?: string;
    kind?: string[];
    groupId?: string;
    loose?: boolean;
    limit?: number;
    cursor?: string;
  } = {},
) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 1000);
  const conditions = [eq(mediaFiles.userId, userId), eq(mediaFiles.status, "ready")];
  if (filter.kind?.length) conditions.push(inArray(mediaFiles.kind, filter.kind));
  if (filter.groupId) conditions.push(eq(mediaGroupFiles.groupId, filter.groupId));
  if (filter.loose) conditions.push(isNull(mediaGroupFiles.groupId));
  const search = filter.search?.trim();
  if (search) conditions.push(contains(mediaFiles.name, search));
  if (filter.cursor) {
    const after = decodeCursor(filter.cursor);
    conditions.push(
      or(
        lt(mediaFiles.createdAt, after.at),
        and(eq(mediaFiles.createdAt, after.at), lt(mediaFiles.id, after.id)),
      )!,
    );
  }
  const rows = await db
    .select({ file: mediaFiles, groupId: mediaGroupFiles.groupId })
    .from(mediaFiles)
    .leftJoin(mediaGroupFiles, eq(mediaGroupFiles.fileId, mediaFiles.id))
    .where(and(...conditions))
    .orderBy(desc(mediaFiles.createdAt), desc(mediaFiles.id))
    .limit(limit + 1);
  const { items, nextCursor } = page(rows, limit, (row) => ({
    at: row.file.createdAt,
    id: row.file.id,
  }));
  return { files: items.map((row) => fileView(row.file, row.groupId)), nextCursor };
}

/** How many of the user's posts in these states use the file — as media, or in metadata. */
async function postsUsing(userId: string, key: string, statuses: string[]) {
  const rows = await db.query.socialPosts.findMany({
    where: and(
      eq(socialPosts.userId, userId),
      inArray(socialPosts.status, statuses),
      // Its one file, a carousel's, or a thumbnail's URL: each holds the key.
      sql`instr(${socialPosts.mediaUrl} || coalesce(${socialPosts.media}, '') || coalesce(${socialPosts.metadata}, ''), ${key}) > 0`,
    ),
    columns: { id: true },
  });
  return rows.length;
}

async function remove(file: MediaFile) {
  await deleteUserFile(file.userId, file.key);
  await db.delete(mediaFiles).where(eq(mediaFiles.id, file.id));
}

/**
 * Deletes a file, unless a post that has not gone out yet still needs it; it leaves its
 * group. A file mixetape never indexed (stored before the index) goes straight from R2.
 */
export async function deleteFile(userId: string, idOrUrl: string) {
  const file = await ownedFile(userId, idOrUrl).catch(() => null);
  if (!file) {
    if (!idOrUrl.startsWith("r2://")) throw new ServiceError("File not found", 404);
    const key = uploads.ownKey(userId, idOrUrl);
    if (!(await deleteUserFile(userId, key))) throw new ServiceError("File not found", 404);
    return { deleted: true, url: `r2://${key}` };
  }
  const pending = await postsUsing(userId, file.key, ["scheduled", "publishing"]);
  if (pending)
    throw new ServiceError(
      `The file is still used by ${pending} post${pending > 1 ? "s" : ""} not yet sent`,
      409,
    );
  await remove(file);
  return { deleted: true, url: `r2://${file.key}` };
}

/**
 * After a post published from the library (cleanup set) is out: deletes its files that no
 * other post still needs, and its group once that is empty.
 */
export async function cleanUpAfterPublish(postId: string) {
  const post = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, postId) });
  if (!post?.cleanup || post.status !== "published") return { deleted: 0 };
  const keys = (post.media?.map((item) => item.url) ?? [post.mediaUrl])
    .filter((url) => url.startsWith("r2://"))
    .map((url) => url.slice("r2://".length));
  let deleted = 0;
  for (const key of keys) {
    const file = await db.query.mediaFiles.findFirst({
      where: and(eq(mediaFiles.userId, post.userId), eq(mediaFiles.key, key)),
    });
    if (!file || (await postsUsing(post.userId, key, NEEDS_FILES))) continue;
    await remove(file);
    deleted++;
  }
  if (post.groupId) {
    const left = await db.query.mediaGroupFiles.findFirst({
      where: eq(mediaGroupFiles.groupId, post.groupId),
    });
    if (!left) await db.delete(mediaGroups).where(eq(mediaGroups.id, post.groupId));
  }
  return { deleted };
}

/**
 * Daily: deletes files stored more than 30 days ago that no post still needs, uploads never
 * finished, and groups emptied by it. A batch at a time; the next run takes the rest.
 */
export async function expireFiles(now = Date.now(), batch = 200) {
  const old = await db.query.mediaFiles.findMany({
    where: or(
      lt(mediaFiles.createdAt, new Date(now - RETENTION)),
      and(
        eq(mediaFiles.status, "uploading"),
        lt(mediaFiles.createdAt, new Date(now - STALE_UPLOAD)),
      ),
    ),
    limit: batch,
  });
  let deleted = 0;
  const groups = new Set<string>();
  for (const file of old) {
    if (file.status === "ready" && (await postsUsing(file.userId, file.key, NEEDS_FILES))) continue;
    const group = await groupOf(file.id);
    if (group) groups.add(group);
    await remove(file);
    deleted++;
  }
  for (const id of groups) {
    const left = await db.query.mediaGroupFiles.findFirst({
      where: eq(mediaGroupFiles.groupId, id),
    });
    if (!left) await db.delete(mediaGroups).where(eq(mediaGroups.id, id));
  }
  return { deleted };
}
