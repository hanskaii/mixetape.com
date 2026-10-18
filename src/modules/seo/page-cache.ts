/**
 * The marketing pages, rendered once per deploy and data centre for people who are not
 * signed in, instead of on every visit: the landing page's server render costs a few hundred
 * milliseconds of CPU, and for a visitor without a session it is the same page each time.
 *
 * Anything that could differ per person stays out: a session cookie (the header shows the
 * account), a query string (a page may read it), a response that sets a cookie.
 */

const PAGES = new Set(["/", "/pricing", "/privacy", "/terms"]);
const TTL_SECONDS = 600;

/** The cache key for a request, or null when it must be rendered for this visitor. */
export function pageCacheKey(request: Request, url: URL, version: string): Request | null {
  if (request.method !== "GET" || url.search || !PAGES.has(url.pathname)) return null;
  if (request.headers.get("cookie")?.includes("session_token")) return null;
  // The version in the key: a deploy never serves the last one's markup or asset names.
  return new Request(`${url.origin}/__page-cache/${version}${url.pathname}`);
}

/** Whether a rendered page may be kept for everyone without a session. */
export function cacheable(response: Response): boolean {
  return (
    response.status === 200 &&
    !response.headers.has("set-cookie") &&
    (response.headers.get("content-type") ?? "").startsWith("text/html")
  );
}

/**
 * The copy for the cache (kept TTL_SECONDS) and the one for the browser. The browser is told
 * not to reuse its copy: after signing in, the same address shows the account.
 */
export function splitForCache(response: Response): [Response, Response] {
  const [forCache, forVisitor] = response.body ? response.body.tee() : [null, null];
  const stored = new Response(forCache, response);
  stored.headers.set("cache-control", `public, max-age=${TTL_SECONDS}`);
  return [
    stored,
    forVisitor ? withVisitorHeaders(new Response(forVisitor, response), "MISS") : response,
  ];
}

/** A cached page as sent to the browser. */
export function withVisitorHeaders(response: Response, state: "HIT" | "MISS"): Response {
  const sent = new Response(response.body, response);
  sent.headers.set("cache-control", "private, no-cache");
  sent.headers.set("x-page-cache", state);
  return sent;
}
