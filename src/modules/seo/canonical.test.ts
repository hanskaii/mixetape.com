import { describe, expect, it, vi } from "vitest";

// siteConfig reads the site's address when it loads: production's, for these cases.
vi.hoisted(() => {
  process.env.SITE_URL = "https://mixetape.com";
});

import { canonicalRedirect } from "./canonical";

const go = (href: string, method = "GET") => {
  const response = canonicalRedirect(new Request(href, { method }), new URL(href));
  return response && { status: response.status, to: response.headers.get("location") };
};

describe("one address per page", () => {
  it("sends http and www to https://mixetape.com, permanently", () => {
    expect(go("http://mixetape.com/pricing?x=1")).toEqual({
      status: 301,
      to: "https://mixetape.com/pricing?x=1",
    });
    expect(go("https://www.mixetape.com/")).toEqual({ status: 301, to: "https://mixetape.com/" });
  });

  it("drops a page's trailing slash with a 308", () => {
    expect(go("https://mixetape.com/pricing/")).toEqual({
      status: 308,
      to: "https://mixetape.com/pricing",
    });
  });

  it("leaves canonical pages, APIs, discovery and other methods alone", () => {
    expect(go("https://mixetape.com/pricing")).toBeNull();
    expect(go("https://mixetape.com/")).toBeNull();
    expect(go("https://mixetape.com/api/v1/posts/")).toBeNull();
    expect(go("https://mixetape.com/.well-known/oauth-authorization-server/")).toBeNull();
    expect(go("https://mixetape.com/pricing/", "POST")).toBeNull();
    expect(go("http://localhost:3001/pricing/")).toBeNull();
  });
});
