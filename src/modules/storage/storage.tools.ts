import { object, READ_ONLY, type Tool } from "#/modules/api/tool";
import { ServiceError } from "#/modules/api/errors";
import { deleteUserFile, listAllOwnedMedia, MEDIA_PREFIX } from "./storage.service";
import * as uploads from "./upload.service";

/**
 * mixetape's file storage for agents. Independent of scheduling: a stored file is just an
 * `r2://` URL, which anything that takes a media URL (such as create_post) accepts.
 */

function decodeFileCursor(cursor: string): { at: number; key: string } {
  try {
    const [at, key] = JSON.parse(atob(cursor)) as [number, string];
    if (typeof at !== "number" || typeof key !== "string") throw new Error();
    return { at, key };
  } catch {
    throw new ServiceError("cursor is not one this API gave out — use nextCursor as it came");
  }
}

export const storageTools: Tool[] = [
  {
    name: "create_upload",
    scope: "storage",
    description:
      "Upload a local file (up to 5 GB) to mixetape storage. Returns uploadUrl, a presigned URL valid for 6 hours: send the whole file in one PUT with exactly the returned Content-Type header — the returned curl command does it (replace <file>). No API key is needed for the PUT. Then use url (r2://…) as mediaUrl in create_post; publicUrl (media.mixetape.com) is the same file for services outside mixetape. For a file already on the web use import_file.",
    inputSchema: object(
      {
        fileName: { type: "string" },
        contentType: { type: "string", description: 'e.g. "video/mp4", "image/jpeg"' },
        size: { type: "number", description: "Size in bytes, to refuse files over 5 GB early" },
      },
      ["fileName"],
    ),
    run: (userId, input) =>
      uploads.createUpload(userId, {
        fileName: input.string("fileName"),
        contentType: input.optionalString("contentType"),
        size: input.number("size"),
      }),
  },
  {
    name: "import_file",
    scope: "storage",
    description:
      "Copy a file from a public https URL (up to 5 GB, with a Content-Length) into mixetape storage — e.g. a video from a render service whose link expires. mixetape fetches it; nothing is sent from your machine. Returns its url (r2://…).",
    inputSchema: object(
      {
        url: { type: "string" },
        fileName: { type: "string", description: "Defaults to the URL's file name" },
      },
      ["url"],
    ),
    run: (userId, input) =>
      uploads.importFromUrl(userId, {
        url: input.string("url"),
        fileName: input.optionalString("fileName"),
      }),
  },
  {
    name: "list_files",
    scope: "storage",
    description:
      "List the files in your mixetape storage, newest first, with url (r2://…) and size — narrow by words in the file name. Returns { files, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object({
      search: { type: "string", description: "Words in the file name (case-insensitive)" },
      limit: { type: "number", description: "Files per page: default 50, max 1000" },
      cursor: { type: "string", description: "nextCursor from the previous page" },
    }),
    annotations: READ_ONLY,
    run: async (userId, input) => {
      const limit = Math.min(Math.max(input.number("limit") ?? 50, 1), 1000);
      const search = input.optionalString("search")?.trim().toLowerCase();
      const cursor = input.optionalString("cursor");
      const after = cursor ? decodeFileCursor(cursor) : null;

      // R2 lists oldest first (keys start with the upload time), so newest first needs them all.
      const files = (await listAllOwnedMedia(userId, `${userId}/`))
        .map((file) => ({
          key: file.key,
          url: `r2://${file.key}`,
          publicUrl: uploads.publicUrl(file.key),
          name: file.key.slice(`${MEDIA_PREFIX}${userId}/`.length).replace(/^\d+-/, ""),
          size: file.size,
          contentType: file.httpMetadata?.contentType,
          uploaded: file.uploaded,
        }))
        .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime() || (a.key < b.key ? 1 : -1))
        .filter((file) => !search || file.name.toLowerCase().includes(search))
        // A page starts after the previous page's last file, in (uploaded, key) order.
        .filter(
          (file) =>
            !after ||
            file.uploaded.getTime() < after.at ||
            (file.uploaded.getTime() === after.at && file.key < after.key),
        );
      const page = files.slice(0, limit);
      const last = page.at(-1);
      return {
        files: page.map(({ key: _key, ...file }) => file),
        nextCursor:
          files.length > limit && last
            ? btoa(JSON.stringify([last.uploaded.getTime(), last.key]))
            : null,
      };
    },
  },
  {
    name: "delete_file",
    scope: "storage",
    description:
      "Delete a file from mixetape storage. A post that still points at it will fail to upload, so only delete files you no longer need.",
    inputSchema: object({ url: { type: "string", description: "r2://… from list_files" } }, [
      "url",
    ]),
    annotations: { destructiveHint: true },
    run: async (userId, input) => {
      const key = uploads.ownKey(userId, input.string("url"));
      if (!(await deleteUserFile(userId, key))) throw new ServiceError("File not found", 404);
      return { deleted: `r2://${key}` };
    },
  },
];
