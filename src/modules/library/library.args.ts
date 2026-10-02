import type { Input } from "#/modules/api/input";

/** Group arguments read the same way for MCP tools and REST endpoints (library.schemas.ts). */

export const groupInput = (input: Input) => ({
  title: input.optionalString("title"),
  caption: input.optionalString("caption"),
  description: input.optionalString("description"),
  fileIds: input.strings("fileIds"),
  metadata: input.object("metadata"),
});

/** The given fields only; an explicit null clears one. */
export function groupChanges(input: Input) {
  const text = (name: string) => (input.raw(name) === null ? null : input.optionalString(name));
  return {
    title: text("title"),
    caption: text("caption"),
    description: text("description"),
    fileIds: input.strings("fileIds"),
    metadata: input.raw("metadata") === null ? null : input.object("metadata"),
  };
}

export const groupFilter = (input: Input) => ({
  search: input.optionalString("search"),
  limit: input.number("limit"),
  cursor: input.optionalString("cursor"),
});

export const target = (input: Input) => ({
  brandIds: input.strings("brandIds"),
  accountIds: input.strings("accountIds"),
});

export const publishOptions = (input: Input) => ({
  scheduledAt: input.optionalString("scheduledAt"),
  leadMinutes: input.number("leadMinutes"),
});

/** Files picked for one post, with their words (SELECTION_FIELDS). */
export const selection = (input: Input) => ({
  fileIds: input.strings("fileIds") ?? [],
  draft: {
    title: input.optionalString("title"),
    caption: input.optionalString("caption"),
    description: input.optionalString("description"),
    metadata: input.object("metadata"),
  },
});
