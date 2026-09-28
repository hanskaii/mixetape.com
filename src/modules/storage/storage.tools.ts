import { object, READ_ONLY, type Tool } from "#/modules/api/tool";
import * as files from "./files.service";

/**
 * mixetape's file storage for agents. Independent of scheduling: a stored file is an
 * `r2://` URL, which anything that takes a media URL (create_post) accepts, and can sit in a
 * library group. Storage is a staging area: files go 30 days after upload, or once the posts
 * published from the library with them are out.
 * Each file is indexed with what was read from it — kind, size in pixels, duration.
 */

const GROUP = {
  type: "string",
  description: "Put the file in this library group (create_group), after its other files",
};

const FILE = {
  type: "string",
  description: "The file's id, or its url (r2://…)",
};

export const storageTools: Tool[] = [
  {
    name: "create_upload",
    scope: "storage",
    description:
      "Upload a local file (up to 5 GB) to mixetape storage, in two steps. 1) This returns fileId and uploadUrl, a presigned URL valid for 6 hours: send the whole file in one PUT with exactly the returned Content-Type header — the returned curl command does it (replace <file>); no API key is needed for the PUT. 2) Then call finish_upload with the fileId: mixetape checks the file and reads what it is. After that, url (r2://…) works as mediaUrl in create_post; with groupId the file lands in that library group. Storage keeps a file 30 days (expiresAt), never while a post not yet sent needs it. For a file already on the web use import_file.",
    inputSchema: object(
      {
        fileName: { type: "string" },
        contentType: { type: "string", description: 'e.g. "video/mp4", "image/jpeg"' },
        size: { type: "number", description: "Size in bytes, to refuse files over 5 GB early" },
        groupId: GROUP,
      },
      ["fileName"],
    ),
    run: (userId, input) =>
      files.createFileUpload(userId, {
        fileName: input.string("fileName"),
        contentType: input.optionalString("contentType"),
        size: input.number("size"),
        groupId: input.optionalString("groupId"),
      }),
  },
  {
    name: "finish_upload",
    scope: "storage",
    description:
      "Finish an upload once its PUT is done: mixetape finds the file and reads its kind, width, height, orientation and duration. Answers the file. Safe to call again.",
    inputSchema: object({ fileId: { type: "string", description: "From create_upload" } }, [
      "fileId",
    ]),
    run: (userId, input) => files.finishUpload(userId, input.string("fileId")),
  },
  {
    name: "import_file",
    scope: "storage",
    description:
      "Copy a file from a public https URL (up to 5 GB, with a Content-Length) into mixetape storage — e.g. a video from a render service whose link expires. mixetape fetches it and reads what it is; nothing is sent from your machine. Answers the file, ready to use.",
    inputSchema: object(
      {
        url: { type: "string" },
        fileName: { type: "string", description: "Defaults to the URL's file name" },
        groupId: GROUP,
      },
      ["url"],
    ),
    run: (userId, input) =>
      files.importFile(userId, {
        url: input.string("url"),
        fileName: input.optionalString("fileName"),
        groupId: input.optionalString("groupId"),
      }),
  },
  {
    name: "list_files",
    scope: "storage",
    description:
      "List the files in your mixetape storage, newest first — each with url (r2://…), kind, size, width, height, orientation (vertical/horizontal/square) and duration. Narrow by kind or words in the file name. Returns { files, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object({
      kind: {
        type: "array",
        items: { type: "string", enum: ["video", "image", "other"] },
        description: "Only these kinds",
      },
      search: { type: "string", description: "Words in the file name (case-insensitive)" },
      groupId: { type: "string", description: "Only the files in this group" },
      loose: { type: "boolean", description: "Only files in no group" },
      limit: { type: "number", description: "Files per page: default 50, max 1000" },
      cursor: { type: "string", description: "nextCursor from the previous page" },
    }),
    annotations: READ_ONLY,
    run: (userId, input) =>
      files.listFiles(userId, {
        kind: input.strings("kind"),
        search: input.optionalString("search"),
        groupId: input.optionalString("groupId"),
        loose: input.raw("loose") === true,
        limit: input.number("limit"),
        cursor: input.optionalString("cursor"),
      }),
  },
  {
    name: "get_file",
    scope: "storage",
    description: "One file in storage: its url, kind, size, width, height, orientation, duration.",
    inputSchema: object({ file: FILE }, ["file"]),
    annotations: READ_ONLY,
    run: (userId, input) => files.getFile(userId, input.string("file")),
  },
  {
    name: "delete_file",
    scope: "storage",
    description:
      "Delete a file from mixetape storage (it leaves its group). Refused while a post that has not gone out yet points at it.",
    inputSchema: object({ file: FILE }, ["file"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => files.deleteFile(userId, input.string("file")),
  },
];
