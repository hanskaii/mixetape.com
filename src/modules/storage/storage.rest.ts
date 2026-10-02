import { object } from "#/modules/api/input";
import type { Endpoint } from "#/modules/api/rest";
import * as files from "./files.service";
import { fileFilter, importInput, uploadInput } from "./storage.args";
import { FILE, FILE_FILTERS, IMPORT_FIELDS, UPLOAD, UPLOAD_FIELDS } from "./storage.schemas";

/**
 * Files in mixetape storage as REST resources. A file's url (r2://…) works wherever a post
 * takes a media URL. Storage is temporary: a file goes once its post is published or
 * cancelled, or 24 hours after upload if no post uses it.
 */

const FILE_ID = { id: "The file's id" };
const ONE_FILE = object({ file: FILE }, ["file"]);

export const storageEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/files",
    operationId: "listFiles",
    tag: "Files",
    scope: "storage",
    query: FILE_FILTERS,
    summary: "List files",
    description:
      "Newest first, each with its kind, size, width, height, orientation and duration, read from the file itself. Pass nextCursor back as cursor for the next page.",
    response: {
      description: "A page of files.",
      schema: object(
        {
          files: { type: "array", items: FILE },
          nextCursor: { type: ["string", "null"], description: "Pass as cursor for the next page" },
        },
        ["files", "nextCursor"],
      ),
    },
    run: (userId, input) => files.listFiles(userId, fileFilter(input)),
  },
  {
    method: "POST",
    path: "/files/uploads",
    operationId: "createUpload",
    tag: "Files",
    scope: "storage",
    summary: "Start an upload",
    description:
      "Uploading a local file (up to 5 GB) takes three steps: this returns a presigned uploadUrl, valid for 6 hours; send the whole file to it in one PUT with exactly the returned headers (no API key needed); then complete it with POST /files/uploads/{fileId}/complete. With groupId, the file lands in that library group.",
    body: object(UPLOAD_FIELDS, ["fileName"]),
    status: 201,
    response: { description: "Where to send the file.", schema: UPLOAD },
    errors: [404],
    run: (userId, input) => files.createFileUpload(userId, uploadInput(input)),
  },
  {
    method: "POST",
    path: "/files/uploads/{id}/complete",
    operationId: "completeUpload",
    tag: "Files",
    scope: "storage",
    params: FILE_ID,
    summary: "Complete an upload",
    description:
      "Once the PUT is done: mixetape finds the file and reads its kind, width, height, orientation and duration. Safe to call again.",
    response: { description: "The file, ready to use.", schema: ONE_FILE },
    errors: [404, 409],
    run: async (userId, input) => ({ file: await files.finishUpload(userId, input.string("id")) }),
  },
  {
    method: "POST",
    path: "/files/imports",
    operationId: "importFile",
    idempotent: true,
    tag: "Files",
    scope: "storage",
    summary: "Import a file from a URL",
    description:
      "mixetape fetches a file from a public https URL (up to 5 GB, with a Content-Length) — e.g. a render whose link expires — and reads what it is. Nothing is sent from your machine.",
    body: object(IMPORT_FIELDS, ["url"]),
    status: 201,
    response: { description: "The file, ready to use.", schema: ONE_FILE },
    errors: [404, 502],
    run: async (userId, input) => ({ file: await files.importFile(userId, importInput(input)) }),
  },
  {
    method: "GET",
    path: "/files/{id}",
    operationId: "getFile",
    tag: "Files",
    scope: "storage",
    params: FILE_ID,
    summary: "Get a file",
    description: "One file in storage, with what was read from it.",
    response: { description: "The file.", schema: ONE_FILE },
    errors: [404],
    run: async (userId, input) => ({ file: await files.getFile(userId, input.string("id")) }),
  },
  {
    method: "DELETE",
    path: "/files/{id}",
    operationId: "deleteFile",
    tag: "Files",
    scope: "storage",
    params: FILE_ID,
    summary: "Delete a file",
    description:
      "Deletes it from storage; it leaves its group. Refused while a post not yet sent uses it.",
    response: {
      description: "Deleted.",
      schema: object({ deleted: { type: "boolean" }, url: { type: "string" } }, ["deleted", "url"]),
    },
    errors: [404, 409],
    run: (userId, input) => files.deleteFile(userId, input.string("id")),
  },
];
