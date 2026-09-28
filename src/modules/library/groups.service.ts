import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "#/database/index";
import {
  mediaFiles,
  mediaGroupFiles,
  mediaGroups,
  socialPosts,
  type JsonValue,
  type MediaGroup,
} from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { contains, decodeCursor, page } from "#/modules/api/cursor";
import { isProvider } from "#/modules/social/providers";
import { deleteFile, dropEmptyGroups, fileView } from "#/modules/storage/files.service";

/**
 * Groups: files that go out together — a carousel, an album — kept in their order, with the
 * words drafted for them (title, caption, description, and `metadata`: fields every
 * platform shares plus `platforms: { youtube: {…} }`, each platform's overrides). An agent
 * uploads into a group and drafts its words; the person publishes it. A file is in at most
 * one group; moving it into another takes it out of the first.
 */

type Metadata = Record<string, JsonValue>;
export type GroupInput = {
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  /** The group's files, in order; replaces them. */
  fileIds?: string[];
  metadata?: Metadata | null;
};

export type GroupView = Awaited<ReturnType<typeof groupViews>>[number];

/** Groups with their ready files, in order, and the posts published from each. */
async function groupViews(groups: MediaGroup[]) {
  if (!groups.length) return [];
  const ids = groups.map((group) => group.id);
  const [links, posts] = await Promise.all([
    db
      .select({ groupId: mediaGroupFiles.groupId, file: mediaFiles })
      .from(mediaGroupFiles)
      .innerJoin(mediaFiles, eq(mediaFiles.id, mediaGroupFiles.fileId))
      .where(and(inArray(mediaGroupFiles.groupId, ids), eq(mediaFiles.status, "ready")))
      .orderBy(asc(mediaGroupFiles.position)),
    db.query.socialPosts.findMany({
      where: inArray(socialPosts.groupId, ids),
      columns: {
        id: true,
        groupId: true,
        accountId: true,
        provider: true,
        status: true,
        scheduledAt: true,
        platformUrl: true,
      },
      orderBy: [asc(socialPosts.scheduledAt)],
    }),
  ]);
  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    caption: group.caption,
    description: group.description,
    metadata: group.metadata ?? {},
    files: links.filter((link) => link.groupId === group.id).map((link) => fileView(link.file)),
    posts: posts
      .filter((post) => post.groupId === group.id)
      .map(({ groupId: _groupId, ...post }) => post),
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }));
}

export function checkMetadata(metadata: Metadata) {
  const platforms = metadata.platforms;
  if (platforms === undefined || platforms === null) return;
  if (typeof platforms !== "object" || Array.isArray(platforms))
    throw new ServiceError('metadata.platforms must be an object, e.g. { "youtube": { … } }');
  for (const [name, value] of Object.entries(platforms)) {
    if (!isProvider(name)) throw new ServiceError(`metadata.platforms.${name}: unknown platform`);
    if (value !== null && (typeof value !== "object" || Array.isArray(value)))
      throw new ServiceError(`metadata.platforms.${name} must be an object`);
  }
}

/** Merges fields: null clears one; `platforms` merges platform by platform, field by field. */
export function mergeMetadata(current: Metadata, changes: Metadata): Metadata {
  const merged: Metadata = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete merged[key];
    else if (key === "platforms" && typeof value === "object" && !Array.isArray(value)) {
      const platforms = { ...(current.platforms as Metadata | undefined) };
      for (const [name, fields] of Object.entries(value)) {
        if (fields === null) delete platforms[name];
        else
          platforms[name] = mergeMetadata(
            (platforms[name] as Metadata | undefined) ?? {},
            fields as Metadata,
          );
      }
      merged.platforms = platforms;
    } else merged[key] = value;
  }
  return merged;
}

/** The user's ready files, in the order given; refuses any that are not. */
export async function readyFiles(userId: string, fileIds: string[]) {
  if (new Set(fileIds).size !== fileIds.length)
    throw new ServiceError("fileIds lists a file twice");
  if (!fileIds.length) return [];
  const files = await db.query.mediaFiles.findMany({
    where: and(eq(mediaFiles.userId, userId), inArray(mediaFiles.id, fileIds)),
  });
  return fileIds.map((id) => {
    const file = files.find((candidate) => candidate.id === id);
    if (!file) throw new ServiceError(`File not found: ${id}`, 404);
    if (file.status !== "ready")
      throw new ServiceError(`File ${file.name} is not ready — finish its upload first`, 409);
    return file;
  });
}

async function ownedGroup(userId: string, id: string) {
  const group = await db.query.mediaGroups.findFirst({
    where: and(eq(mediaGroups.id, id), eq(mediaGroups.userId, userId)),
  });
  if (!group) throw new ServiceError("Group not found", 404);
  return group;
}

/** Puts files into a group at the end (or as its only files), out of any other group. */
async function place(groupId: string, fileIds: string[], { replace = false } = {}) {
  if (replace) await db.delete(mediaGroupFiles).where(eq(mediaGroupFiles.groupId, groupId));
  if (!fileIds.length) return;
  // Files moving in from other carousels leave them; one left empty ends.
  const from = await db.query.mediaGroupFiles.findMany({
    where: inArray(mediaGroupFiles.fileId, fileIds),
  });
  await db.delete(mediaGroupFiles).where(inArray(mediaGroupFiles.fileId, fileIds));
  const rest = replace
    ? []
    : await db.query.mediaGroupFiles.findMany({ where: eq(mediaGroupFiles.groupId, groupId) });
  const start = rest.reduce((max, link) => Math.max(max, link.position + 1), 0);
  await db
    .insert(mediaGroupFiles)
    .values(fileIds.map((fileId, index) => ({ groupId, fileId, position: start + index })));
  await dropEmptyGroups(from.map((link) => link.groupId).filter((id) => id !== groupId));
}

const clean = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : value.trim() || null;

export async function createGroup(
  userId: string,
  input: GroupInput,
  createdBy: "agent" | "user",
): Promise<GroupView> {
  const metadata = input.metadata ?? {};
  checkMetadata(metadata);
  const files = await readyFiles(userId, input.fileIds ?? []);
  const id = crypto.randomUUID();
  await db.insert(mediaGroups).values({
    id,
    userId,
    title: clean(input.title) ?? null,
    caption: clean(input.caption) ?? null,
    description: clean(input.description) ?? null,
    metadata,
    createdBy,
  });
  await place(
    id,
    files.map((file) => file.id),
  );
  return getGroup(userId, id);
}

/**
 * Changes the given fields; `fileIds`, when given, replaces the files and their order (the
 * ones left out stay in storage, in no group). Metadata merges (see mergeMetadata) unless
 * `replaceMetadata`: the workspace sends the whole of it.
 */
export async function updateGroup(
  userId: string,
  id: string,
  input: GroupInput,
  { replaceMetadata = false } = {},
) {
  const group = await ownedGroup(userId, id);
  const changes: Partial<typeof mediaGroups.$inferInsert> = { updatedAt: new Date() };
  for (const field of ["title", "caption", "description"] as const) {
    const value = clean(input[field]);
    if (value !== undefined) changes[field] = value;
  }
  if (input.metadata !== undefined) {
    const metadata =
      input.metadata === null
        ? {}
        : replaceMetadata
          ? input.metadata
          : mergeMetadata(group.metadata ?? {}, input.metadata);
    checkMetadata(metadata);
    changes.metadata = metadata;
  }
  if (input.fileIds) {
    const files = await readyFiles(userId, input.fileIds);
    await place(
      id,
      files.map((file) => file.id),
      { replace: true },
    );
  }
  await db.update(mediaGroups).set(changes).where(eq(mediaGroups.id, id));
  return getGroup(userId, id);
}

/** Moves files into a group, after the ones it has. */
export async function addToGroup(userId: string, id: string, fileIds: string[]) {
  await ownedGroup(userId, id);
  const files = await readyFiles(userId, fileIds);
  await place(
    id,
    files.map((file) => file.id),
  );
  await db.update(mediaGroups).set({ updatedAt: new Date() }).where(eq(mediaGroups.id, id));
  return getGroup(userId, id);
}

/** Takes files out of whatever group they are in; they stay in storage. A group left empty goes. */
export async function ungroupFiles(userId: string, fileIds: string[]) {
  const files = await readyFiles(userId, fileIds);
  if (!files.length) return { ungrouped: 0 };
  const ids = files.map((file) => file.id);
  const from = await db.query.mediaGroupFiles.findMany({
    where: inArray(mediaGroupFiles.fileId, ids),
  });
  await db.delete(mediaGroupFiles).where(inArray(mediaGroupFiles.fileId, ids));
  await dropEmptyGroups(from.map((link) => link.groupId));
  return { ungrouped: files.length };
}

export async function getGroup(userId: string, id: string) {
  const [view] = await groupViews([await ownedGroup(userId, id)]);
  return view;
}

/** Groups, newest first, a page at a time; narrowed by words in the title/caption/description. */
export async function listGroups(
  userId: string,
  filter: { search?: string; limit?: number; cursor?: string } = {},
) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const conditions = [eq(mediaGroups.userId, userId)];
  const search = filter.search?.trim();
  if (search)
    conditions.push(
      or(
        contains(mediaGroups.title, search),
        contains(mediaGroups.caption, search),
        contains(mediaGroups.description, search),
      )!,
    );
  if (filter.cursor) {
    const after = decodeCursor(filter.cursor);
    conditions.push(
      or(
        lt(mediaGroups.createdAt, after.at),
        and(eq(mediaGroups.createdAt, after.at), lt(mediaGroups.id, after.id)),
      )!,
    );
  }
  const rows = await db.query.mediaGroups.findMany({
    where: and(...conditions),
    orderBy: [desc(mediaGroups.createdAt), desc(mediaGroups.id)],
    limit: limit + 1,
  });
  const { items, nextCursor } = page(rows, limit, (group) => ({
    at: group.createdAt,
    id: group.id,
  }));
  return { groups: await groupViews(items), nextCursor };
}

/**
 * Deletes a group. Its files stay in storage, in no group — or, with `deleteFiles`, go too,
 * except any a post that has not gone out yet still needs (those are listed in `kept`).
 */
export async function deleteGroup(userId: string, id: string, { deleteFiles = false } = {}) {
  const group = await getGroup(userId, id);
  const kept: string[] = [];
  if (deleteFiles)
    for (const file of group.files)
      await deleteFile(userId, file.id).catch((error: unknown) => {
        if (!(error instanceof ServiceError)) throw error;
        kept.push(file.name);
      });
  await db.delete(mediaGroups).where(eq(mediaGroups.id, id));
  return { deleted: true, id, ...(kept.length && { kept }) };
}
