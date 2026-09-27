import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A Facebook post's metadata, as stored on the post and accepted by the API and MCP. */
export type FacebookVideoMeta = {
  /** "video" posts a Page video; "reel" posts a Reel (vertical 9:16, 3–90 seconds). */
  format?: "video" | "reel";
  /** Page videos only; Reels have no title. */
  title?: string;
  description?: string;
  /** Public https JPEG/PNG set right after upload. */
  thumbnailUrl?: string;
  /** Subtitle tracks (public https SRT) uploaded right after the video. */
  captions?: { language: string; url: string }[];
  /** Posted as the Page's own comment once the post is public. */
  firstComment?: string;
  /** Set by the scheduler from scheduledAt, never by callers. */
  publishAt?: string;
};

/** Fields that can still change once the post is on Facebook. */
export const EDITABLE_FIELDS = ["title", "description"] as const;

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

function string(value: JsonValue, name: string): string {
  return typeof value === "string" ? value.trim() : fail(`${name} must be text`);
}

function httpsUrl(value: JsonValue, name: string): string {
  const url = string(value, name);
  return url.startsWith("https://") ? url : fail(`${name} must be a public https URL`);
}

const FIELDS: Record<string, (value: JsonValue) => JsonValue> = {
  format: (value) => {
    const format = string(value, "format");
    return format === "video" || format === "reel"
      ? format
      : fail('format must be "video" or "reel"');
  },
  title: (value) => {
    const title = string(value, "title");
    return title.length <= 255
      ? title
      : fail("Facebook video titles are limited to 255 characters");
  },
  description: (value) => {
    const text = string(value, "description");
    return text.length <= 63_206 ? text : fail("description is longer than Facebook allows");
  },
  thumbnailUrl: (value) => httpsUrl(value, "thumbnailUrl"),
  captions: (value) =>
    (Array.isArray(value) ? value : fail("captions must be a list")).map((entry) => {
      const fields =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? entry
          : fail("each caption must be an object");
      const url = httpsUrl(fields.url ?? "", "captions.url");
      if (!/\.srt(\?|$)/i.test(url)) fail("Facebook captions must be SRT files (.srt)");
      return { language: string(fields.language ?? "", "captions.language"), url };
    }),
  firstComment: (value) => {
    const text = string(value, "firstComment");
    return text.length <= 8_000 ? text : fail("firstComment is longer than Facebook allows");
  },
};

function checkFields(
  input: Metadata,
  allowed: readonly string[],
  refusal: (key: string) => string,
) {
  const out: Metadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (!allowed.includes(key)) fail(refusal(key));
    out[key] = FIELDS[key](value);
  }
  return out;
}

/** Checks the fields of a live edit; only EDITABLE_FIELDS are allowed. */
export function checkChanges(changes: Metadata): Metadata {
  return checkFields(
    changes,
    EDITABLE_FIELDS,
    (key) => `"${key}" cannot be changed once the post is on Facebook`,
  );
}

export const facebookMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata = checkFields(
      rest,
      Object.keys(FIELDS),
      (key) => `Unknown Facebook field "${key}"`,
    );
    if (metadata.format === "reel" && metadata.title)
      fail("Reels have no title; put the text in description");
    if (metadata.description === undefined && caption?.trim())
      metadata.description = caption.trim();
    return metadata;
  },

  schema: {
    type: "object",
    description:
      'Facebook Page fields. format "video" (default) posts a Page video; "reel" posts a Reel (9:16, 3–90 s). Set a field to null to clear it when updating.',
    properties: {
      format: { type: "string", enum: ["video", "reel"] },
      title: { type: "string", maxLength: 255, description: "Page videos only" },
      description: { type: "string", description: "The post text (defaults to caption)" },
      thumbnailUrl: {
        type: "string",
        description: "Public https JPEG/PNG, set right after upload",
      },
      captions: {
        type: "array",
        description: "Subtitle files (public https .srt) uploaded right after the video",
        items: {
          type: "object",
          properties: {
            language: { type: "string", description: 'e.g. "en", "id" or "en_US"' },
            url: { type: "string" },
          },
          required: ["language", "url"],
        },
      },
      firstComment: {
        type: "string",
        description: "Posted as the Page's own comment once the post is public",
      },
    },
  },
};
