import { ServiceError } from "#/modules/api/errors";
import { object, READ_ONLY, type Tool } from "#/modules/api/tool";
import { deleteUserFile, listOwnedMedia, MEDIA_PREFIX } from "./storage.service";
import * as uploads from "./upload.service";

/**
 * mixetape's file storage for agents. Independent of scheduling: a stored file is just an
 * `r2://` URL, which anything that takes a media URL (such as create_post) accepts.
 */

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
      "List the files in your mixetape storage, newest first, with url (r2://…) and size.",
    inputSchema: object({ limit: { type: "number", description: "Default 50, max 1000" } }),
    annotations: READ_ONLY,
    run: async (userId, input) => {
      const limit = Math.min(Math.max(input.number("limit") ?? 50, 1), 1000);
      // R2 lists oldest first (keys start with the upload time); newest first needs them all.
      const files = await listOwnedMedia(userId, `${userId}/`, 1000);
      return files
        .map((file) => ({
          url: `r2://${file.key}`,
          publicUrl: uploads.publicUrl(file.key),
          name: file.key.slice(`${MEDIA_PREFIX}${userId}/`.length).replace(/^\d+-/, ""),
          size: file.size,
          contentType: file.httpMetadata?.contentType,
          uploaded: file.uploaded,
        }))
        .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
        .slice(0, limit);
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
