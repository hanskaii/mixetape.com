import type { JsonValue } from "#/database/schema";
import { InvalidInputError, type Metadata, type MetadataSpec } from "../types";

/** A Threads video post's metadata. */
export type ThreadsVideoMeta = {
  /** The post text (defaults to the post caption), ≤ 500 characters. */
  text?: string;
  /** Posted as the profile's own reply once the post is public. */
  firstComment?: string;
  /** Set by the scheduler from scheduledAt, never by callers. */
  publishAt?: string;
};

const fail = (message: string): never => {
  throw new InvalidInputError(message);
};

function text(value: JsonValue, name: string): string {
  const content = typeof value === "string" ? value.trim() : fail(`${name} must be text`);
  return [...content].length <= 500
    ? content
    : fail(`Threads ${name} is limited to 500 characters`);
}

export const threadsMetadata: MetadataSpec = {
  validate(input, caption) {
    const { publishAt: _publishAt, ...rest } = input;
    const metadata: Metadata = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null || value === undefined) continue;
      if (key === "text" || key === "firstComment") metadata[key] = text(value, key);
      else fail(`Unknown Threads field "${key}"`);
    }
    if (metadata.text === undefined && caption?.trim()) metadata.text = text(caption, "text");
    return metadata;
  },

  schema: {
    type: "object",
    description:
      "Threads video fields (MP4/MOV, ≤ 5 min, ≤ 1 GB). Set a field to null to clear it when updating.",
    properties: {
      text: { type: "string", maxLength: 500, description: "Defaults to the post caption" },
      firstComment: {
        type: "string",
        maxLength: 500,
        description: "Posted as the profile's own reply once the post is public",
      },
    },
  },
};
