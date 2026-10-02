import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A Bluesky post's fields: the text (300 characters), languages, alt texts, a warning. */

export const MAX_GRAPHEMES = 300;
const LABELS = ["sexual", "nudity", "porn", "graphic-media"] as const;

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

export const graphemes = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;

const postText = (value: JsonValue, name: string) => {
  const text = typeof value === "string" ? value.trim() : fail(`${name} must be text`);
  return graphemes(text) <= MAX_GRAPHEMES
    ? text
    : fail(`Bluesky ${name} is limited to ${MAX_GRAPHEMES} characters`);
};

export const blueskyMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      switch (key) {
        case "text":
        case "firstComment":
          metadata[key] = postText(value, key);
          break;
        case "langs":
          metadata[key] =
            Array.isArray(value) &&
            value.length <= 3 &&
            value.every(
              (item) => typeof item === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(item),
            )
              ? value
              : fail('langs must be up to 3 language codes, e.g. ["en"]');
          break;
        case "altTexts":
          metadata[key] =
            Array.isArray(value) && value.every((item) => typeof item === "string")
              ? value.map((item) => (item as string).slice(0, 2000))
              : fail("altTexts must be a list of text, one per file");
          break;
        case "contentWarning":
          metadata[key] = LABELS.includes(value as (typeof LABELS)[number])
            ? value
            : fail(`contentWarning must be one of ${LABELS.join(", ")}`);
          break;
        default:
          fail(`Unknown Bluesky field "${key}"`);
      }
    }
    if (metadata.text === undefined && caption?.trim())
      metadata.text = postText(caption, "caption");
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "Bluesky post fields — a video (up to 3 min), an image, or up to 4 images, with text of up to 300 characters. Links, #hashtags and @handles in the text become links. Set a field to null to clear it when updating.",
    properties: {
      text: {
        type: "string",
        description: "The post text, ≤ 300 characters; defaults to the post caption",
      },
      langs: {
        type: "array",
        items: { type: "string" },
        maxItems: 3,
        description: 'The text\'s languages, e.g. ["en"]',
      },
      altTexts: {
        type: "array",
        items: { type: "string" },
        description: "Image and video descriptions, one per file, in order",
      },
      contentWarning: {
        type: "string",
        enum: LABELS,
        description: "Labels the media for adult or graphic content",
      },
      firstComment: {
        type: "string",
        description: "Posted as the account's own reply once the post is up — a thread",
      },
    },
  },
};
