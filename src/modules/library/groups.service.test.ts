import { describe, expect, it, vi } from "vitest";

vi.mock("#/database/index", () => ({ db: {} }));

import { checkMetadata, mergeMetadata } from "./groups.service";

describe("a group's metadata", () => {
  it("changes only the fields given, and null clears one", () => {
    expect(
      mergeMetadata(
        { tags: ["a"], thumbnailUrl: "r2://t.jpg" },
        { tags: ["b"], thumbnailUrl: null },
      ),
    ).toEqual({ tags: ["b"] });
  });

  it("merges platform overrides platform by platform, field by field", () => {
    const current = {
      tags: ["history"],
      platforms: { youtube: { title: "Long title", privacy: "public" }, facebook: { title: "FB" } },
    };
    expect(
      mergeMetadata(current, { platforms: { youtube: { title: "Shorter" }, facebook: null } }),
    ).toEqual({
      tags: ["history"],
      platforms: { youtube: { title: "Shorter", privacy: "public" } },
    });
  });

  it("starts platform overrides on an item without any", () => {
    expect(mergeMetadata({}, { platforms: { instagram: { caption: "hi" } } })).toEqual({
      platforms: { instagram: { caption: "hi" } },
    });
  });

  it("refuses platforms mixetape does not know, and overrides that are not objects", () => {
    expect(() => checkMetadata({ platforms: { myspace: {} } })).toThrow(/unknown platform/);
    expect(() => checkMetadata({ platforms: { youtube: "title" } })).toThrow(/must be an object/);
    expect(() => checkMetadata({ platforms: ["youtube"] })).toThrow(/must be an object/);
    expect(() =>
      checkMetadata({ tags: ["x"], platforms: { youtube: { title: "t" } } }),
    ).not.toThrow();
  });
});
