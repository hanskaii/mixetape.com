import { object } from "#/modules/api/input";
import { READ_ONLY, type Tool } from "#/modules/api/tool";
import * as files from "./files.service";
import { fileFilter, importInput, uploadInput } from "./storage.args";
import { FILE_FILTERS, IMPORT_FIELDS, UPLOAD_FIELDS } from "./storage.schemas";

/**
 * mixetape's file storage for agents. Independent of scheduling: a stored file is an
 * `r2://` URL, which anything that takes a media URL (create_post) accepts, and can sit in a
 * library group. Storage is a staging area: a file goes once its post is published or
 * cancelled, or 24 hours after upload if no post uses it — a file in a group included.
 * Each file is indexed with what was read from it — kind, size in pixels, duration. Field
 * schemas are shared with the REST API (storage.schemas.ts).
 */

const FILE = {
  type: "string",
  description: "The file's id, or its url (r2://…)",
};

export const storageTools: Tool[] = [
  {
    name: "create_upload",
    scope: "storage",
    description:
      "Upload a local file (up to 5 GB) to mixetape storage, in two steps. 1) This returns fileId and uploadUrl, a presigned URL valid for 6 hours: send the whole file in one PUT with exactly the returned Content-Type header — the returned curl command does it (replace <file>); no API key is needed for the PUT. 2) Then call finish_upload with the fileId: mixetape checks the file and reads what it is. After that, url (r2://…) works as mediaUrl in create_post; with groupId the file lands in that library group. Storage is temporary: the file is deleted once its post is published or cancelled, or 24 hours after upload (expiresAt) if no post uses it by then — schedule it within a day. For a file already on the web use import_file.",
    inputSchema: object(UPLOAD_FIELDS, ["fileName"]),
    run: (userId, input) => files.createFileUpload(userId, uploadInput(input)),
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
    idempotent: true,
    scope: "storage",
    description:
      "Copy a file from a public https URL (up to 5 GB, with a Content-Length) into mixetape storage — e.g. a video from a render service whose link expires. mixetape fetches it and reads what it is; nothing is sent from your machine. Answers the file, ready to use.",
    inputSchema: object(IMPORT_FIELDS, ["url"]),
    run: (userId, input) => files.importFile(userId, importInput(input)),
  },
  {
    name: "list_files",
    scope: "storage",
    description:
      "List the files in your mixetape storage, newest first — each with url (r2://…), kind, size, width, height, orientation (vertical/horizontal/square) and duration. Narrow by kind or words in the file name. Returns { files, nextCursor }; pass nextCursor back as cursor for the next page (null on the last).",
    inputSchema: object(FILE_FILTERS),
    annotations: READ_ONLY,
    run: (userId, input) => files.listFiles(userId, fileFilter(input)),
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
