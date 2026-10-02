import { object } from "#/modules/api/input";

/**
 * JSON Schemas for files in storage: the fields MCP tools and REST endpoints both take, and
 * what REST answers.
 */

const GROUP = {
  type: "string",
  description: "Put the file in this library group, after its other files",
};

export const UPLOAD_FIELDS = {
  fileName: { type: "string" },
  contentType: { type: "string", description: 'e.g. "video/mp4", "image/jpeg"' },
  size: { type: "integer", description: "Size in bytes, to refuse files over 5 GB early" },
  groupId: GROUP,
};

export const IMPORT_FIELDS = {
  url: { type: "string", description: "A public https URL, up to 5 GB, with a Content-Length" },
  fileName: { type: "string", description: "Defaults to the URL's file name" },
  groupId: GROUP,
};

export const FILE_FILTERS = {
  kind: {
    type: "array",
    items: { type: "string", enum: ["video", "image", "other"] },
    description: "Only these kinds",
  },
  search: { type: "string", description: "Words in the file name" },
  groupId: { type: "string", description: "Only the files in this group" },
  loose: { type: "boolean", description: "Only files in no group" },
  limit: { type: "integer", minimum: 1, maximum: 1000, description: "Files per page, default 50" },
  cursor: { type: "string", description: "nextCursor from the previous page" },
};

const STRING = { type: "string" };
const DATE_TIME = { type: "string", format: "date-time" };
const NULLABLE_INT = { type: ["integer", "null"] };

export const FILE = object(
  {
    id: STRING,
    url: { type: "string", description: "r2:// URL: works wherever a post takes a media URL" },
    publicUrl: STRING,
    name: STRING,
    kind: { type: "string", enum: ["video", "image", "other"] },
    contentType: STRING,
    size: { type: "integer", description: "Bytes" },
    width: NULLABLE_INT,
    height: NULLABLE_INT,
    durationMs: NULLABLE_INT,
    orientation: { type: ["string", "null"], enum: ["vertical", "horizontal", "square", null] },
    status: {
      type: "string",
      enum: ["uploading", "ready"],
      description: "uploading: waiting for its upload to finish",
    },
    groupId: { type: ["string", "null"] },
    createdAt: DATE_TIME,
    expiresAt: { ...DATE_TIME, description: "When storage deletes it, if nothing needs it then" },
  },
  ["id", "url", "name", "kind", "contentType", "size", "status", "createdAt", "expiresAt"],
);

export const UPLOAD = object(
  {
    fileId: { type: "string", description: "Finish the upload with this id" },
    url: { type: "string", description: "r2:// URL, usable once the upload is finished" },
    publicUrl: STRING,
    uploadUrl: { type: "string", description: "Presigned URL: send the whole file in one PUT" },
    method: { type: "string", enum: ["PUT"] },
    headers: { type: "object", description: "Send exactly these headers with the PUT" },
    expiresAt: { ...DATE_TIME, description: "The upload URL works until then (6 hours)" },
    curl: { type: "string", description: "The PUT as a curl command; replace <file>" },
  },
  ["fileId", "url", "uploadUrl", "method", "headers", "expiresAt"],
);
