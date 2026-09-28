import { getProvider } from "./providers";

/**
 * A platform's metadata as form fields, read from its JSON schema, so the workspace can offer
 * a real form per platform instead of JSON. Fields that are lists of objects or maps
 * (captions, localizations) are left to agents and the API; the title and description a
 * platform takes from the shared fields (textFields) are edited there, once.
 */

export type Field = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "tags";
  options?: string[];
  hint?: string;
  maxLength?: number;
  /** The platform's own caption field: a per-platform caption, defaulting to the shared one. */
  caption?: boolean;
  /** Only means something for a single video (a cover, a Reel/video choice). */
  videoOnly?: boolean;
};

/** Fields about a single video: covers, the Reel/video choice, feed sharing for Reels. */
const VIDEO_ONLY = new Set([
  "format",
  "thumbnailUrl",
  "coverFrameMs",
  "coverFrameSeconds",
  "shareToFeed",
  "playlistIds",
]);

type Property = {
  type?: string;
  enum?: string[];
  description?: string;
  maxLength?: number;
  items?: { type?: string };
};

const LABELS: Record<string, string> = {
  thumbnailUrl: "Thumbnail URL",
  privacyStatus: "Privacy",
  privacyLevel: "Privacy",
  madeForKids: "Made for kids",
  playlistIds: "Playlists",
  coverFrameMs: "Cover frame (ms)",
  coverFrameSeconds: "Cover frame (s)",
  boardId: "Board",
  isAigc: "AI-generated",
  altText: "Alt text",
  shareToFeed: "Also show in feed",
};

const humanize = (key: string) =>
  LABELS[key] ??
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (first) => first.toUpperCase())
    .replace(/ (\w)/g, (_, c: string) => ` ${c.toLowerCase()}`);

/** The keys a platform treats as its caption (it defaults them from the post caption). */
const CAPTION_KEYS: Record<string, string> = {
  instagram: "caption",
  threads: "text",
  tiktok: "title",
};

export function platformFields(provider: string): Field[] {
  const platform = getProvider(provider);
  const properties = (platform.metadata.schema.properties ?? {}) as Record<string, Property>;
  const shared = new Set(Object.values(platform.textFields ?? {}));
  const fields: Field[] = [];
  for (const [key, property] of Object.entries(properties)) {
    if (shared.has(key)) continue;
    const caption = CAPTION_KEYS[provider] === key;
    const base = {
      key,
      label: caption ? "Caption" : humanize(key),
      hint: caption ? "Leave empty to use the caption above" : property.description,
      maxLength: property.maxLength,
      ...(caption && { caption: true }),
      ...(VIDEO_ONLY.has(key) && { videoOnly: true }),
    };
    if (property.enum) fields.push({ ...base, type: "select", options: property.enum });
    else if (property.type === "boolean") fields.push({ ...base, type: "boolean" });
    else if (property.type === "number") fields.push({ ...base, type: "number" });
    else if (property.type === "array" && property.items?.type === "string")
      fields.push({ ...base, type: "tags" });
    else if (property.type === "string")
      fields.push({
        ...base,
        type: caption || key === "firstComment" || key === "description" ? "textarea" : "text",
      });
  }
  return fields;
}
