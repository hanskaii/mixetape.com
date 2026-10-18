import { describe, expect, it } from "vitest";
import { cacheable, pageCacheKey, splitForCache, withVisitorHeaders } from "./page-cache";

const key = (href: string, init: RequestInit = {}) =>
  pageCacheKey(new Request(href, init), new URL(href), "v1")?.url ?? null;

const html = (init: ResponseInit = {}) =>
  new Response("<html></html>", {
    status: 200,
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });

describe("pageCacheKey", () => {
  it("keys the marketing pages by deploy", () => {
    expect(key("https://mixetape.com/")).toBe("https://mixetape.com/__page-cache/v1/");
    expect(key("https://mixetape.com/pricing")).toBe(
      "https://mixetape.com/__page-cache/v1/pricing",
    );
  });

  it("renders for a signed-in visitor", () => {
    expect(
      key("https://mixetape.com/", {
        headers: { cookie: "theme=dark; __Secure-better-auth.session_token=abc" },
      }),
    ).toBeNull();
    expect(key("https://mixetape.com/", { headers: { cookie: "theme=dark" } })).not.toBeNull();
  });

  it("leaves other pages, query strings and other methods alone", () => {
    expect(key("https://mixetape.com/media")).toBeNull();
    expect(key("https://mixetape.com/?ref=x")).toBeNull();
    expect(key("https://mixetape.com/", { method: "POST" })).toBeNull();
  });
});

describe("cacheable", () => {
  it("keeps only a plain 200 HTML page", () => {
    expect(cacheable(html())).toBe(true);
    expect(cacheable(html({ status: 500 }))).toBe(false);
    expect(cacheable(html({ headers: { "set-cookie": "a=b" } }))).toBe(false);
    expect(cacheable(new Response("{}", { headers: { "content-type": "application/json" } }))).toBe(
      false,
    );
  });
});

describe("splitForCache", () => {
  it("lets the cache keep a copy and tells the browser not to", async () => {
    const [stored, sent] = splitForCache(html());
    expect(stored.headers.get("cache-control")).toBe("public, max-age=600");
    expect(sent.headers.get("cache-control")).toBe("private, no-cache");
    expect(sent.headers.get("x-page-cache")).toBe("MISS");
    expect(await stored.text()).toBe("<html></html>");
    expect(await sent.text()).toBe("<html></html>");
  });

  it("marks a page served from the cache", () => {
    const sent = withVisitorHeaders(
      html({ headers: { "cache-control": "public, max-age=600" } }),
      "HIT",
    );
    expect(sent.headers.get("cache-control")).toBe("private, no-cache");
    expect(sent.headers.get("x-page-cache")).toBe("HIT");
  });
});
