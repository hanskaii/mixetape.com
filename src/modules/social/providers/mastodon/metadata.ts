import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A Mastodon post's fields. The server's own text limit is checked when it is published. */

const VISIBILITY = ["public", "unlisted", "private"] as const;

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

const text = (value: JsonValue, name: string, max: number) => {
  const content = typeof value === "string" ? value.trim() : fail(`${name} must be text`);
  return [...content].length <= max ? content : fail(`${name} is limited to ${max} characters`);
};

export const mastodonMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      switch (key) {
        case "text":
        case "firstComment":
          metadata[key] = text(value, key, 5000);
          break;
        case "spoilerText":
          metadata[key] = text(value, key, 500);
          break;
        case "visibility":
          metadata[key] = VISIBILITY.includes(value as (typeof VISIBILITY)[number])
            ? value
            : fail(`visibility must be one of ${VISIBILITY.join(", ")}`);
          break;
        case "sensitive":
          metadata[key] =
            typeof value === "boolean" ? value : fail("sensitive must be true or false");
          break;
        case "language":
          metadata[key] =
            typeof value === "string" && /^[a-z]{2}$/.test(value)
              ? value
              : fail('language must be a two-letter ISO 639-1 code, e.g. "en"');
          break;
        case "altTexts":
          metadata[key] =
            Array.isArray(value) && value.every((item) => typeof item === "string")
              ? value.map((item) => text(item, "altTexts", 1500))
              : fail("altTexts must be a list of text, one per file");
          break;
        default:
          fail(`Unknown Mastodon field "${key}"`);
      }
    }
    if (metadata.text === undefined && caption?.trim()) metadata.text = caption.trim();
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "Mastodon post fields — a video, an image, or up to 4 images, with text. The text limit is the server's own (500 characters on most; links count as 23). Set a field to null to clear it when updating.",
    properties: {
      text: { type: "string", description: "The post text; defaults to the post caption" },
      visibility: {
        type: "string",
        enum: VISIBILITY,
        description:
          "public (default), unlisted (not in public timelines) or private (followers only)",
      },
      spoilerText: {
        type: "string",
        maxLength: 500,
        description: "A content warning shown before the post",
      },
      sensitive: { type: "boolean", description: "Hide the media behind a warning" },
      language: { type: "string", description: 'ISO 639-1 code of the text, e.g. "en"' },
      altTexts: {
        type: "array",
        items: { type: "string", maxLength: 1500 },
        description: "Image and video descriptions, one per file, in order",
      },
      firstComment: {
        type: "string",
        description: "Posted as the account's own reply once the post is up — a thread",
      },
    },
  },
};
