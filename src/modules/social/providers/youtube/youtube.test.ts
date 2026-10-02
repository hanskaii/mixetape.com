import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidInputError } from "../types";
import { youtube } from ".";

type Call = { url: URL; init?: RequestInit };

/** A fetch that answers each call with the next response, and records the calls. */
function scriptFetch(responses: Response[]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: new URL(String(input)), init });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected fetch: ${String(input)}`);
      return next;
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("youtube.metadata", () => {
  const validate = youtube.metadata.validate;

  it("takes the caption as title and drops a caller's publishAt", () => {
    expect(validate({ publishAt: "2026-10-01T00:00:00Z", tags: [" a ", ""] }, "Caption")).toEqual({
      title: "Caption",
      tags: ["a"],
    });
  });

  it("refuses what YouTube would refuse", () => {
    expect(() => validate({}, null)).toThrow("needs a title");
    expect(() => validate({ title: "a <b>" }, null)).toThrow("< or >");
    expect(() => validate({ title: "t", colour: "red" }, null)).toThrow(
      'Unknown YouTube field "colour"',
    );
    expect(() => validate({ title: "t", localizations: { id: { title: "j" } } }, null)).toThrow(
      "defaultLanguage",
    );
    expect(() => validate({ title: "t", category: "Education" }, null)).toThrow(InvalidInputError);
  });
});

describe("youtube.editing", () => {
  it("lays the changes over the current video and keeps its publish time", async () => {
    const calls = scriptFetch([
      Response.json({
        items: [
          {
            id: "v1",
            snippet: { title: "Old", description: "D", categoryId: "27", tags: ["x"] },
            status: {
              privacyStatus: "private",
              publishAt: "2026-10-02T10:00:00Z",
              embeddable: true,
            },
          },
        ],
      }),
      Response.json({ id: "v1" }),
    ]);

    await youtube.editing!.update("v1", { title: "New", madeForKids: false }, "token");

    const put = calls[1];
    expect(put.url.searchParams.get("part")).toBe("snippet,status");
    expect(JSON.parse(String(put.init?.body))).toEqual({
      id: "v1",
      snippet: { title: "New", description: "D", categoryId: "27", tags: ["x"] },
      status: {
        privacyStatus: "private",
        publishAt: "2026-10-02T10:00:00Z",
        selfDeclaredMadeForKids: false,
        embeddable: true,
      },
    });
  });

  it("refuses fields that cannot change once the video is up", async () => {
    await expect(
      youtube.editing!.update("v1", { thumbnailUrl: "https://x/y.jpg" }, "token"),
    ).rejects.toThrow("cannot be changed");
  });
});

describe("youtube.analytics", () => {
  it("maps YouTube's report columns to mixetape metrics", async () => {
    const report = (names: string[], rows: (string | number)[][]) =>
      Response.json({ columnHeaders: names.map((name) => ({ name })), rows });
    const calls = scriptFetch([
      report(["views", "estimatedMinutesWatched", "averageViewPercentage"], [[120, 300.5, 41.237]]),
      report(
        ["elapsedVideoTimeRatio", "audienceWatchRatio", "relativeRetentionPerformance"],
        [[0.01, 1.2, 0.6]],
      ),
      report(
        ["insightTrafficSourceType", "views", "estimatedMinutesWatched"],
        [["YT_SEARCH", 80, 200]],
      ),
    ]);

    const result = await youtube.analytics!.post("v1", "token", {
      from: "2026-09-01",
      to: "2026-09-27",
    });

    expect(result.totals).toEqual({
      views: 120,
      watchTimeMinutes: 300.5,
      averageViewPercentage: 41.24,
    });
    expect(result.retention).toEqual([
      { position: 0.01, watchRatio: 1.2, relativePerformance: 0.6 },
    ]);
    expect(result.trafficSources).toEqual([
      { source: "YT_SEARCH", views: 80, watchTimeMinutes: 200 },
    ]);
    expect(calls[0].url.searchParams.get("filters")).toBe("video==v1");
    expect(calls[0].url.searchParams.get("ids")).toBe("channel==MINE");
  });
});

describe("youtube.connect", () => {
  const app = { clientId: "id", clientSecret: "secret" };

  it("refuses a consent where a permission was unticked", async () => {
    scriptFetch([
      Response.json({
        access_token: "a",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/youtube.force-ssl",
      }),
    ]);
    await expect(
      youtube.connect.exchangeCode(app, { code: "c", redirectUri: "https://m/cb" }),
    ).rejects.toThrow("view YouTube Analytics");
  });

  it("asks for exactly the two permissions it needs", () => {
    const url = new URL(
      youtube.connect.authorizeUrl!({ clientId: "id", redirectUri: "https://m/cb", state: "s" }),
    );
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ]);
  });
});
