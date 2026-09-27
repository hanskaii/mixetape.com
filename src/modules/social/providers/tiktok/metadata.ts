import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

export const PRIVACY_LEVELS = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;

/** A TikTok video's metadata. */
export type TikTokVideoMeta = {
  /** The caption (defaults to the post caption), ≤ 2,200 characters. */
  title?: string;
  /**
   * Who can see it. Defaults to SELF_ONLY: an app TikTok has not audited can only post
   * privately, and a public default would surprise anyone.
   */
  privacyLevel?: (typeof PRIVACY_LEVELS)[number];
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  /** The cover frame, in milliseconds from the start. */
  coverFrameMs?: number;
  /** Label the video as AI-generated content. */
  isAigc?: boolean;
};

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

const bool = (name: string) => (value: JsonValue) =>
  typeof value === "boolean" ? value : fail(`${name} must be true or false`);

function title(value: JsonValue): string {
  const text = typeof value === "string" ? value.trim() : fail("title must be text");
  return [...text].length <= 2200 ? text : fail("TikTok captions are limited to 2,200 characters");
}

const FIELDS: Record<string, (value: JsonValue) => JsonValue> = {
  title,
  privacyLevel: (value) =>
    typeof value === "string" && (PRIVACY_LEVELS as readonly string[]).includes(value)
      ? value
      : fail(`privacyLevel must be one of ${PRIVACY_LEVELS.join(", ")}`),
  disableComment: bool("disableComment"),
  disableDuet: bool("disableDuet"),
  disableStitch: bool("disableStitch"),
  coverFrameMs: (value) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : fail("coverFrameMs must be a whole number of milliseconds"),
  isAigc: bool("isAigc"),
};

export const tiktokMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      const check = FIELDS[key] ?? fail(`Unknown TikTok field "${key}"`);
      metadata[key] = check(value);
    }
    if (metadata.title === undefined && caption?.trim()) metadata.title = title(caption);
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "TikTok fields. The video posts at the scheduled time (TikTok cannot hold a post). Until TikTok audits the app, only SELF_ONLY works.",
    properties: {
      title: { type: "string", description: "Caption, ≤ 2,200 characters; defaults to caption" },
      privacyLevel: {
        type: "string",
        enum: [...PRIVACY_LEVELS],
        description: "Default SELF_ONLY (required until the app is audited)",
      },
      disableComment: { type: "boolean" },
      disableDuet: { type: "boolean" },
      disableStitch: { type: "boolean" },
      coverFrameMs: { type: "number", description: "Cover frame, ms from the start" },
      isAigc: { type: "boolean", description: "Label as AI-generated content" },
    },
  },
};
