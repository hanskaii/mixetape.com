import type { Input } from "#/modules/api/input";

/** File arguments read the same way for MCP tools and REST endpoints (storage.schemas.ts). */

export const uploadInput = (input: Input) => ({
  fileName: input.string("fileName"),
  contentType: input.optionalString("contentType"),
  size: input.number("size"),
  groupId: input.optionalString("groupId"),
});

export const importInput = (input: Input) => ({
  url: input.string("url"),
  fileName: input.optionalString("fileName"),
  groupId: input.optionalString("groupId"),
});

export const fileFilter = (input: Input) => ({
  kind: input.strings("kind"),
  search: input.optionalString("search"),
  groupId: input.optionalString("groupId"),
  loose: input.raw("loose") === true,
  limit: input.number("limit"),
  cursor: input.optionalString("cursor"),
});
