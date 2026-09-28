import { describe, expect, it, vi } from "vitest";

vi.mock("#/database/index", () => ({ db: {} }));

import { platformFields } from "./fields";

describe("a platform's form", () => {
  it("offers YouTube's own fields, not the shared title and description", () => {
    const fields = platformFields("youtube");
    const keys = fields.map((field) => field.key);
    expect(keys).not.toContain("title");
    expect(keys).not.toContain("description");
    for (const hidden of ["captions", "localizations", "defaultLanguage", "playlistIds"])
      expect(keys).not.toContain(hidden);
    expect(fields.find((field) => field.key === "privacyStatus")).toMatchObject({
      type: "choice",
      label: "Visibility",
      options: [
        { value: "public", label: "Public" },
        { value: "unlisted", label: "Unlisted" },
        { value: "private", label: "Private" },
      ],
    });
    expect(fields.find((field) => field.key === "thumbnailUrl")?.type).toBe("image");
    // Switches come last, the caption-like fields first.
    expect(fields.at(-1)?.type).toBe("switch");
    expect(fields.find((field) => field.key === "category")).toMatchObject({
      type: "select",
      options: expect.arrayContaining([{ value: "27", label: "Education" }]),
    });
    expect(fields.find((field) => field.key === "tags")?.type).toBe("tags");
    expect(fields.find((field) => field.key === "madeForKids")?.type).toBe("switch");
  });

  it("shows a platform's own caption field as a per-platform caption", () => {
    expect(platformFields("instagram").find((field) => field.key === "caption")).toMatchObject({
      label: "Caption",
      type: "textarea",
      caption: true,
    });
    expect(platformFields("tiktok").find((field) => field.key === "title")).toMatchObject({
      caption: true,
    });
  });
});
