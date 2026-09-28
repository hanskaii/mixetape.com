import { createServerFn } from "@tanstack/react-start";
import type { JsonValue } from "#/database/schema";
import { currentUserId } from "#/modules/auth/auth.server";
import * as files from "#/modules/storage/files.service";
import * as library from "./library.service";

/**
 * Server functions behind the Library page — the same services the library and storage
 * tools use, so what a person files here is what an agent finds, and the other way round.
 */

type Metadata = Record<string, JsonValue>;

export const getLibraryData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [fileList, itemList] = await Promise.all([
    files.listFiles(userId, { limit: 60 }),
    library.listItems(userId, { limit: 40 }),
  ]);
  return { files: fileList, items: itemList };
});

export const listLibraryFiles = createServerFn({ method: "GET" })
  .validator((data: { search?: string; kind?: string[]; cursor?: string }) => data)
  .handler(async ({ data }) => files.listFiles(await currentUserId(), { ...data, limit: 60 }));

export const listLibraryItems = createServerFn({ method: "GET" })
  .validator((data: { search?: string; cursor?: string }) => data)
  .handler(async ({ data }) => library.listItems(await currentUserId(), { ...data, limit: 40 }));

// ── content ─────────────────────────────────────────────────────────────────

type ContentInput = {
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  fileIds?: string[];
  metadata?: Metadata;
};

export const createContent = createServerFn({ method: "POST" })
  .validator((data: ContentInput) => data)
  .handler(async ({ data }) => library.createItem(await currentUserId(), data, "user"));

export const updateContent = createServerFn({ method: "POST" })
  .validator((data: ContentInput & { id: string }) => data)
  .handler(async ({ data: { id, ...changes } }) =>
    library.updateItem(await currentUserId(), id, changes, { replaceMetadata: true }),
  );

export const removeContent = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => library.deleteItem(await currentUserId(), data.id));
