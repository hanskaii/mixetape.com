import type { Input } from "#/modules/api/input";
import type { CreatePostInput, EditPostInput, PostFilter } from "./social.service";

/** Post arguments read the same way for MCP tools and REST endpoints (social.schemas.ts). */

export function postFilter(input: Input): PostFilter {
  const date = (name: string) => {
    const value = input.optionalString(name);
    return value ? new Date(value) : undefined;
  };
  return {
    accountId: input.strings("accountId"),
    provider: input.strings("provider"),
    status: input.strings("status"),
    groupId: input.optionalString("groupId"),
    search: input.optionalString("search"),
    from: date("from"),
    to: date("to"),
    updatedSince: date("updatedSince"),
    limit: input.number("limit") ?? 50,
    cursor: input.optionalString("cursor"),
  };
}

/** What a new post carries, besides its account. */
export function postInput(input: Input): Omit<CreatePostInput, "accountId"> {
  return {
    mediaUrl: input.optionalString("mediaUrl"),
    media: input.strings("media"),
    caption: input.optionalString("caption"),
    scheduledAt: input.optionalString("scheduledAt"),
    leadMinutes: input.number("leadMinutes"),
    metadata: input.object("metadata"),
  };
}

/** Only the fields that were given, so the rest of the post stays as it is. */
export function postChanges(input: Input): EditPostInput {
  return Object.fromEntries(
    Object.entries(postInput(input)).filter(([, value]) => value !== undefined),
  ) as EditPostInput;
}
