import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A Pin's metadata. */
export type PinterestPinMeta = {
  /** The board the Pin goes to (one of the account's collections); required. */
  boardId?: string;
  title?: string;
  description?: string;
  /** Where the Pin leads when clicked. */
  link?: string;
  altText?: string;
  /** Video Pins: public https cover image. */
  thumbnailUrl?: string;
  /** Video Pins: or the cover frame, in seconds from the start (default 1). */
  coverFrameSeconds?: number;
};

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

const text = (name: string, max: number) => (value: JsonValue) => {
  const content = typeof value === "string" ? value.trim() : fail(`${name} must be text`);
  return [...content].length <= max
    ? content
    : fail(`Pinterest ${name} is limited to ${max} characters`);
};

const https = (name: string) => (value: JsonValue) => {
  const url = typeof value === "string" ? value.trim() : fail(`${name} must be a URL`);
  return url.startsWith("https://") ? url : fail(`${name} must be a public https URL`);
};

const FIELDS: Record<string, (value: JsonValue) => JsonValue> = {
  boardId: text("boardId", 64),
  title: text("title", 100),
  description: text("description", 800),
  link: https("link"),
  altText: text("altText", 500),
  thumbnailUrl: https("thumbnailUrl"),
  coverFrameSeconds: (value) =>
    typeof value === "number" && value >= 0
      ? value
      : fail("coverFrameSeconds must be zero or more"),
};

export const pinterestMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      const check = FIELDS[key] ?? fail(`Unknown Pinterest field "${key}"`);
      metadata[key] = check(value);
    }
    if (!metadata.boardId)
      fail("A Pin needs boardId: one of the account's boards (its collections)");
    if (metadata.description === undefined && caption?.trim())
      metadata.description = text("description", 800)(caption);
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "Pinterest Pin fields. Video (mp4/mov) or image media. The Pin posts at the scheduled time (Pinterest cannot hold a post).",
    properties: {
      boardId: {
        type: "string",
        description: "A board id from the account's collections (required)",
      },
      title: { type: "string", maxLength: 100 },
      description: { type: "string", maxLength: 800, description: "Defaults to the post caption" },
      link: { type: "string", description: "Destination URL when the Pin is clicked" },
      altText: { type: "string", maxLength: 500 },
      thumbnailUrl: { type: "string", description: "Video Pins: public https cover image" },
      coverFrameSeconds: {
        type: "number",
        description: "Video Pins: cover frame, seconds (default 1)",
      },
    },
  },
};
