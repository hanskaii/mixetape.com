import { getProvider } from "./providers";

/**
 * A platform's metadata as a form, read from its JSON schema, so the workspace can offer a
 * real form per platform instead of JSON. The form keeps to what a person decides while
 * publishing: technical fields (a language code, playlist ids, subtitle files, a cover
 * frame in milliseconds) stay with agents and the API; the title and description a platform
 * takes from the shared fields (textFields) are edited there, once.
 */

export type Field = {
  key: string;
  label: string;
  /**
   * choice: a few options side by side; image: an image from the library; switch: on or
   * off; tags: a list of words.
   */
  type: "text" | "textarea" | "number" | "switch" | "choice" | "select" | "tags" | "image";
  options?: { value: string; label: string }[];
  hint?: string;
  maxLength?: number;
  /** The platform's own caption field: a per-platform caption, defaulting to the shared one. */
  caption?: boolean;
  /** Only means something for a single video (a cover, a Reel/video choice). */
  videoOnly?: boolean;
};

/** Fields about a single video: covers, the Reel/video choice, feed sharing for Reels. */
const VIDEO_ONLY = new Set(["format", "thumbnailUrl", "shareToFeed"]);

/** Left to agents and the API: codes and ids a person would not type while publishing. */
const HIDDEN = new Set([
  "defaultLanguage",
  "localizations",
  "captions",
  "playlistIds",
  "coverFrameMs",
  "coverFrameSeconds",
]);

type Property = {
  type?: string;
  enum?: string[];
  /** Named choices for a free field (YouTube's categories), shown as a list in the form. */
  "x-options"?: { value: string; label: string }[];
  description?: string;
  maxLength?: number;
  items?: { type?: string };
};

const LABELS: Record<string, string> = {
  thumbnailUrl: "Thumbnail",
  privacyStatus: "Visibility",
  privacyLevel: "Who can watch",
  madeForKids: "Made for kids",
  notifySubscribers: "Notify subscribers",
  shareToFeed: "Also show in your grid",
  boardId: "Board",
  isAigc: "Made with AI",
  altText: "Alt text",
  disableComment: "Turn off comments",
  disableDuet: "Turn off Duet",
  disableStitch: "Turn off Stitch",
  firstComment: "First comment",
};

// Written for people, where the schema's descriptions are written for agents.
const HINTS: Record<string, string> = {
  tags: "Words that help people find it",
  madeForKids: "Required when it is made for children",
  notifySubscribers: "Tell subscribers it is out",
  shareToFeed: "The Reel shows in your profile grid as well",
  firstComment: "Posted as your own comment once it is live",
  link: "Where the Pin leads",
  altText: "Describes the image for people who cannot see it",
  boardId: "The board the Pin goes to",
  isAigc: "Label it as AI-generated",
};

const OPTION_LABELS: Record<string, string> = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
  video: "Video",
  reel: "Reel",
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
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
  facebook: "description",
};

// The form's order: the caption, the choices, the cover, the rest, the comment, the switches.
const ORDER: Record<Field["type"], number> = {
  textarea: 0,
  choice: 1,
  select: 2,
  image: 3,
  text: 4,
  number: 4,
  tags: 5,
  switch: 7,
};

export function platformFields(provider: string): Field[] {
  const platform = getProvider(provider);
  const properties = (platform.metadata.schema.properties ?? {}) as Record<string, Property>;
  const shared = new Set(Object.values(platform.textFields ?? {}));
  const fields: Field[] = [];
  for (const [key, property] of Object.entries(properties)) {
    if (shared.has(key) || HIDDEN.has(key)) continue;
    const caption = CAPTION_KEYS[provider] === key;
    const base = {
      key,
      label: caption ? "Caption" : humanize(key),
      hint: caption ? "Leave empty to use the caption above" : HINTS[key],
      maxLength: property.maxLength,
      ...(caption && { caption: true }),
      ...(VIDEO_ONLY.has(key) && { videoOnly: true }),
    };
    const named = property["x-options"];
    const options = property.enum?.map((value) => ({
      value,
      label: OPTION_LABELS[value] ?? value.replace(/_/g, " ").toLowerCase(),
    }));
    if (named) fields.push({ ...base, type: "select", options: named });
    else if (options)
      fields.push({ ...base, type: options.length <= 3 ? "choice" : "select", options });
    else if (property.type === "boolean") fields.push({ ...base, type: "switch" });
    else if (property.type === "number") fields.push({ ...base, type: "number" });
    else if (property.type === "array" && property.items?.type === "string")
      fields.push({ ...base, type: "tags" });
    else if (key === "thumbnailUrl") fields.push({ ...base, type: "image" });
    else if (property.type === "string")
      fields.push({
        ...base,
        type: caption || key === "firstComment" || key === "description" ? "textarea" : "text",
      });
  }
  // The first comment comes after everything but the switches.
  const weight = (field: Field) => (field.key === "firstComment" ? 6 : ORDER[field.type]);
  return fields.sort((a, b) => weight(a) - weight(b));
}
