import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "#/database/index";
import {
  libraryItemFiles,
  libraryItems,
  mediaFiles,
  socialPosts,
  type JsonValue,
  type LibraryItem,
} from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { contains, decodeCursor, page } from "#/modules/api/cursor";
import { isProvider } from "#/modules/social/providers";
import { fileView } from "#/modules/storage/files.service";

/**
 * Content items: media in storage plus the metadata an agent or a person wrote for it, not
 * scheduled anywhere yet. An item's `metadata` holds the fields every platform shares
 * (tags, thumbnailUrl, firstComment…) and `platforms: { youtube: {…}, facebook: {…} }`,
 * each platform's overrides — so a YouTube title can differ from an Instagram caption, and
 * whatever is not overridden comes from the shared fields.
 */

type Metadata = Record<string, JsonValue>;
export type ItemInput = {
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  fileIds?: string[];
  metadata?: Metadata | null;
};

export type ItemView = Awaited<ReturnType<typeof itemViews>>[number];

/** Items with their files, in each item's order, and the posts scheduled from each. */
async function itemViews(items: LibraryItem[]) {
  if (!items.length) return [];
  const ids = items.map((item) => item.id);
  const posts = await db.query.socialPosts.findMany({
    where: inArray(socialPosts.itemId, ids),
    columns: {
      id: true,
      itemId: true,
      accountId: true,
      provider: true,
      status: true,
      scheduledAt: true,
      platformUrl: true,
    },
    orderBy: [asc(socialPosts.scheduledAt)],
  });
  const links = await db
    .select({
      itemId: libraryItemFiles.itemId,
      position: libraryItemFiles.position,
      file: mediaFiles,
    })
    .from(libraryItemFiles)
    .innerJoin(mediaFiles, eq(mediaFiles.id, libraryItemFiles.fileId))
    .where(inArray(libraryItemFiles.itemId, ids))
    .orderBy(asc(libraryItemFiles.position));
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    caption: item.caption,
    description: item.description,
    metadata: item.metadata ?? {},
    files: links.filter((link) => link.itemId === item.id).map((link) => fileView(link.file)),
    posts: posts
      .filter((post) => post.itemId === item.id)
      .map(({ itemId: _itemId, ...post }) => post),
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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
async function readyFiles(userId: string, fileIds: string[]) {
  if (new Set(fileIds).size !== fileIds.length)
    throw new ServiceError("fileIds lists a file twice");
  if (!fileIds.length) return [];
  const files = await db.query.mediaFiles.findMany({
    where: and(eq(mediaFiles.userId, userId), inArray(mediaFiles.id, fileIds)),
  });
  for (const id of fileIds) {
    const file = files.find((candidate) => candidate.id === id);
    if (!file) throw new ServiceError(`File not found: ${id}`, 404);
    if (file.status !== "ready")
      throw new ServiceError(`File ${file.name} is not ready — finish its upload first`, 409);
  }
  return fileIds;
}

async function ownedItem(userId: string, id: string) {
  const item = await db.query.libraryItems.findFirst({
    where: and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)),
  });
  if (!item) throw new ServiceError("Content item not found", 404);
  return item;
}

const clean = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : value.trim() || null;

export async function createItem(
  userId: string,
  input: ItemInput,
  createdBy: "agent" | "user",
): Promise<ItemView> {
  const metadata = input.metadata ?? {};
  checkMetadata(metadata);
  const fileIds = await readyFiles(userId, input.fileIds ?? []);
  const id = crypto.randomUUID();
  await db.insert(libraryItems).values({
    id,
    userId,
    title: clean(input.title) ?? null,
    caption: clean(input.caption) ?? null,
    description: clean(input.description) ?? null,
    metadata,
    createdBy,
  });
  if (fileIds.length)
    await db
      .insert(libraryItemFiles)
      .values(fileIds.map((fileId, position) => ({ itemId: id, fileId, position })));
  return getItem(userId, id);
}

/**
 * Changes the given fields; `fileIds`, when given, replaces the files and their order.
 * Metadata merges (see mergeMetadata) unless `replaceMetadata`: the workspace's editor sends
 * the whole of it.
 */
export async function updateItem(
  userId: string,
  id: string,
  input: ItemInput,
  { replaceMetadata = false } = {},
) {
  const item = await ownedItem(userId, id);
  const changes: Partial<typeof libraryItems.$inferInsert> = { updatedAt: new Date() };
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
          : mergeMetadata(item.metadata ?? {}, input.metadata);
    checkMetadata(metadata);
    changes.metadata = metadata;
  }
  if (input.fileIds) {
    const fileIds = await readyFiles(userId, input.fileIds);
    await db.delete(libraryItemFiles).where(eq(libraryItemFiles.itemId, id));
    if (fileIds.length)
      await db
        .insert(libraryItemFiles)
        .values(fileIds.map((fileId, position) => ({ itemId: id, fileId, position })));
  }
  await db.update(libraryItems).set(changes).where(eq(libraryItems.id, id));
  return getItem(userId, id);
}

export async function getItem(userId: string, id: string) {
  const [view] = await itemViews([await ownedItem(userId, id)]);
  return view;
}

/** Items, newest first, a page at a time; narrowed by words in the title/caption/description. */
export async function listItems(
  userId: string,
  filter: { search?: string; limit?: number; cursor?: string } = {},
) {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const conditions = [eq(libraryItems.userId, userId)];
  const search = filter.search?.trim();
  if (search) {
    conditions.push(
      or(
        contains(libraryItems.title, search),
        contains(libraryItems.caption, search),
        contains(libraryItems.description, search),
      )!,
    );
  }
  if (filter.cursor) {
    const after = decodeCursor(filter.cursor);
    conditions.push(
      or(
        lt(libraryItems.createdAt, after.at),
        and(eq(libraryItems.createdAt, after.at), lt(libraryItems.id, after.id)),
      )!,
    );
  }
  const rows = await db.query.libraryItems.findMany({
    where: and(...conditions),
    orderBy: [desc(libraryItems.createdAt), desc(libraryItems.id)],
    limit: limit + 1,
  });
  const { items, nextCursor } = page(rows, limit, (item) => ({ at: item.createdAt, id: item.id }));
  return { items: await itemViews(items), nextCursor };
}

/** Deletes an item; its files stay in storage. */
export async function deleteItem(userId: string, id: string) {
  await ownedItem(userId, id);
  await db.delete(libraryItems).where(eq(libraryItems.id, id));
  return { deleted: true, id };
}
