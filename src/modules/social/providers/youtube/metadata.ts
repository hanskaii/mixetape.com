import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A YouTube post's metadata, as stored on the post and accepted by the API and MCP. */
export type YouTubeVideoMeta = {
  title: string;
  description?: string;
  /** YouTube category id, e.g. "27" Education, "22" People & Blogs. */
  category?: string;
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
  madeForKids?: boolean;
  notifySubscribers?: boolean;
  /** BCP-47 language of title and description, e.g. "en"; needed for localizations. */
  defaultLanguage?: string;
  /** Title and description in other languages, keyed by BCP-47 code. */
  localizations?: Record<string, { title: string; description?: string }>;
  /** Public https JPEG/PNG (≤ 2 MB, 1280×720), set right after upload. */
  thumbnailUrl?: string;
  /** Playlists the video joins right after upload. */
  playlistIds?: string[];
  /** Subtitle tracks (public https SRT/WebVTT) uploaded right after the video. */
  captions?: { language: string; name?: string; url: string }[];
  /** Posted as the channel's own comment once the video is public. */
  firstComment?: string;
  /** Set by the scheduler from scheduledAt, never by callers. */
  publishAt?: string;
};

/** Fields that can still change once the video is on YouTube (videos.update). */
export const EDITABLE_FIELDS = [
  "title",
  "description",
  "category",
  "tags",
  "privacyStatus",
  "madeForKids",
  "defaultLanguage",
  "localizations",
] as const;

// ── field checks ─────────────────────────────────────────────────────────────

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

function string(value: JsonValue, name: string): string {
  return typeof value === "string" ? value.trim() : fail(`${name} must be text`);
}

function boolean(value: JsonValue, name: string): boolean {
  return typeof value === "boolean" ? value : fail(`${name} must be true or false`);
}

function object(value: JsonValue, name: string): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fail(`${name} must be an object`);
}

function list(value: JsonValue, name: string): JsonValue[] {
  return Array.isArray(value) ? value : fail(`${name} must be a list`);
}

/** YouTube refuses angle brackets in titles and descriptions. */
function plain(value: JsonValue, name: string, max: number): string {
  const text = string(value, name);
  if (/[<>]/.test(text)) fail(`YouTube does not allow < or > in the ${name}`);
  if (new TextEncoder().encode(text).length > max) fail(`${name} is longer than YouTube allows`);
  return text;
}

function title(value: JsonValue, name = "title"): string {
  const text = plain(value, name, 400);
  if (!text) fail("A YouTube video needs a title");
  if ([...text].length > 100) fail("YouTube titles are limited to 100 characters");
  return text;
}

function language(value: JsonValue, name: string): string {
  const code = string(value, name);
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(code)
    ? code
    : fail(`${name} must be a language code such as "en" or "id"`);
}

function httpsUrl(value: JsonValue, name: string): string {
  const url = string(value, name);
  return url.startsWith("https://") ? url : fail(`${name} must be a public https URL`);
}

const FIELDS: Record<string, (value: JsonValue) => JsonValue> = {
  title: (value) => title(value),
  description: (value) => plain(value, "description", 5000),
  category: (value) => {
    const id = string(value, "category");
    return /^\d+$/.test(id) ? id : fail('category must be a YouTube category id such as "27"');
  },
  tags: (value) => {
    const tags = list(value, "tags")
      .map((tag) => string(tag, "each tag"))
      .filter(Boolean);
    // YouTube counts a tag with spaces as if it were quoted, plus a separator per tag.
    const length = tags.reduce((sum, tag) => sum + tag.length + (tag.includes(" ") ? 2 : 0), 0);
    if (length + Math.max(tags.length - 1, 0) > 500)
      fail("YouTube allows 500 characters of tags in total");
    return tags;
  },
  privacyStatus: (value) => {
    const privacy = string(value, "privacyStatus");
    return ["public", "unlisted", "private"].includes(privacy)
      ? privacy
      : fail("privacyStatus must be public, unlisted or private");
  },
  madeForKids: (value) => boolean(value, "madeForKids"),
  notifySubscribers: (value) => boolean(value, "notifySubscribers"),
  defaultLanguage: (value) => language(value, "defaultLanguage"),
  localizations: (value) =>
    Object.fromEntries(
      Object.entries(object(value, "localizations")).map(([code, entry]) => {
        const fields = object(entry, `localizations.${code}`);
        return [
          language(code, "each localization key"),
          {
            title: title(fields.title ?? "", `localizations.${code}.title`),
            ...(fields.description != null && {
              description: plain(fields.description, `localizations.${code}.description`, 5000),
            }),
          },
        ];
      }),
    ),
  thumbnailUrl: (value) => httpsUrl(value, "thumbnailUrl"),
  playlistIds: (value) =>
    list(value, "playlistIds")
      .map((id) => string(id, "each playlist id"))
      .filter(Boolean),
  captions: (value) =>
    list(value, "captions").map((entry) => {
      const fields = object(entry, "each caption");
      return {
        language: language(fields.language ?? "", "captions.language"),
        ...(fields.name != null && { name: string(fields.name, "captions.name") }),
        url: httpsUrl(fields.url ?? "", "captions.url"),
      };
    }),
  firstComment: (value) => {
    const text = string(value, "firstComment");
    return text.length <= 10_000 ? text : fail("firstComment is longer than YouTube allows");
  },
};

/** Checks the given fields; null clears a field, anything not allowed is refused. */
function checkFields(
  input: Metadata,
  allowed: readonly string[],
  refusal: (key: string) => string,
): Metadata {
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
    (key) => `"${key}" cannot be changed once the video is on YouTube`,
  );
}

export const youtubeMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata = checkFields(
      rest,
      Object.keys(FIELDS),
      (key) => `Unknown YouTube field "${key}"`,
    );
    metadata.title = title(metadata.title ?? caption ?? "");
    if (metadata.localizations && !metadata.defaultLanguage)
      fail("Set defaultLanguage (the language of title and description) to add localizations");
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "YouTube fields. title is required when creating. Set a field to null to clear it when updating.",
    properties: {
      title: { type: "string", maxLength: 100, description: "No < or >" },
      description: { type: "string", maxLength: 5000, description: "No < or >" },
      category: {
        type: "string",
        description: 'Category id, e.g. "27" Education, "22" People & Blogs (the default)',
        // The categories a video can be put in, for the workspace's form.
        "x-options": [
          { value: "1", label: "Film & Animation" },
          { value: "2", label: "Autos & Vehicles" },
          { value: "10", label: "Music" },
          { value: "15", label: "Pets & Animals" },
          { value: "17", label: "Sports" },
          { value: "19", label: "Travel & Events" },
          { value: "20", label: "Gaming" },
          { value: "22", label: "People & Blogs" },
          { value: "23", label: "Comedy" },
          { value: "24", label: "Entertainment" },
          { value: "25", label: "News & Politics" },
          { value: "26", label: "Howto & Style" },
          { value: "27", label: "Education" },
          { value: "28", label: "Science & Technology" },
          { value: "29", label: "Nonprofits & Activism" },
        ],
      },
      tags: { type: "array", items: { type: "string" }, description: "≤ 500 characters in total" },
      privacyStatus: { type: "string", enum: ["public", "unlisted", "private"] },
      madeForKids: { type: "boolean" },
      notifySubscribers: { type: "boolean" },
      defaultLanguage: {
        type: "string",
        description: 'Language of title/description, e.g. "en"; required for localizations',
      },
      localizations: {
        type: "object",
        description:
          'Translations keyed by language: { "id": { "title": "…", "description": "…" } }',
        additionalProperties: {
          type: "object",
          properties: { title: { type: "string" }, description: { type: "string" } },
          required: ["title"],
        },
      },
      thumbnailUrl: {
        type: "string",
        description: "Public https JPEG/PNG, ≤ 2 MB, 1280×720; set right after upload",
      },
      playlistIds: {
        type: "array",
        items: { type: "string" },
        description: "Playlists (list_collections) the video joins right after upload",
      },
      captions: {
        type: "array",
        description: "Subtitle files uploaded right after the video (400 quota units each)",
        items: {
          type: "object",
          properties: {
            language: { type: "string", description: 'e.g. "en"' },
            name: { type: "string", description: "Track name; empty is the default track" },
            url: { type: "string", description: "Public https SRT or WebVTT" },
          },
          required: ["language", "url"],
        },
      },
      firstComment: {
        type: "string",
        description:
          "Posted as the channel's own comment once the video is public — e.g. a link to the full video from a Short",
      },
    },
  },
};
