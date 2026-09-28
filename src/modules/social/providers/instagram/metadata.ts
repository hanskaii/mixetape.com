import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** An Instagram Reel's metadata, as stored on the post and accepted by the API and MCP. */
export type InstagramReelMeta = {
  /** The Reel's caption (defaults to the post caption): ≤ 2,200 characters, 30 hashtags. */
  caption?: string;
  /** Public https JPEG for the cover; set when the Reel is created, not after. */
  thumbnailUrl?: string;
  /** Or: the frame to use as cover, in milliseconds from the start. */
  coverFrameMs?: number;
  /** Also show the Reel in the profile's feed grid (default true). */
  shareToFeed?: boolean;
  /** Posted as the account's own comment once the Reel is public. */
  firstComment?: string;
  /** Set by the scheduler from scheduledAt, never by callers. */
  publishAt?: string;
};

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

function string(value: JsonValue, name: string): string {
  return typeof value === "string" ? value.trim() : fail(`${name} must be text`);
}

function caption(value: JsonValue): string {
  const text = string(value, "caption");
  if ([...text].length > 2200) fail("Instagram captions are limited to 2,200 characters");
  if ((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30)
    fail("Instagram allows at most 30 hashtags in a caption");
  if ((text.match(/@[\w.]+/g) ?? []).length > 20)
    fail("Instagram allows at most 20 @mentions in a caption");
  return text;
}

const FIELDS: Record<string, (value: JsonValue) => JsonValue> = {
  caption,
  thumbnailUrl: (value) => {
    const url = string(value, "thumbnailUrl");
    return url.startsWith("https://") ? url : fail("thumbnailUrl must be a public https URL");
  },
  coverFrameMs: (value) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : fail("coverFrameMs must be a whole number of milliseconds"),
  shareToFeed: (value) =>
    typeof value === "boolean" ? value : fail("shareToFeed must be true or false"),
  firstComment: (value) => {
    const text = string(value, "firstComment");
    return [...text].length <= 2200 ? text : fail("firstComment is longer than Instagram allows");
  },
};

export const instagramMetadata: MetadataSpec = {
  validate(input, postCaption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      const check = FIELDS[key] ?? fail(`Unknown Instagram field "${key}"`);
      metadata[key] = check(value);
    }
    if (metadata.caption === undefined && postCaption?.trim())
      metadata.caption = caption(postCaption);
    if (metadata.thumbnailUrl !== undefined && metadata.coverFrameMs !== undefined)
      fail("Choose either thumbnailUrl or coverFrameMs for the cover, not both");
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "Instagram fields. A video posts as a Reel (3 s–15 min, ≤ 300 MB, 9:16 recommended), a JPEG image as a photo, several files (media) as a carousel of 2–10. The cover fields and shareToFeed apply to Reels only. Set a field to null to clear it when updating.",
    properties: {
      caption: {
        type: "string",
        description: "≤ 2,200 characters, 30 hashtags, 20 @mentions; defaults to the post caption",
      },
      thumbnailUrl: { type: "string", description: "Public https JPEG cover, set at creation" },
      coverFrameMs: { type: "number", description: "Or the cover frame, ms from the start" },
      shareToFeed: { type: "boolean", description: "Also show it in the feed grid (default true)" },
      firstComment: {
        type: "string",
        description: "Posted as the account's own comment once the Reel is public",
      },
    },
  },
};
