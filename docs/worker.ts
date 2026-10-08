/**
 * In front of the static docs: every redirect is permanent and takes one hop. The asset
 * server adds a trailing slash with a 307, and Astro's redirects (moved pages) are HTML
 * meta refreshes; search engines read both as less than a move. Everything else is served
 * as built.
 */
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

/** "/agents/tools" → "/agents/tools/": the docs' pages all end in a slash. */
const withSlash = (path: string) =>
  path.startsWith("/") && !path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path) ? `${path}/` : path;

/**
 * Where a moved page points, read from the start of its HTML (Astro writes these as
 * `<!doctype html><title>Redirecting to: …` with a meta refresh); null for any other page.
 */
async function movedTo(response: Response): Promise<string | null> {
  const reader = response.clone().body?.getReader();
  if (!reader) return null;
  const { value } = await reader.read();
  void reader.cancel();
  const start = new TextDecoder().decode(value?.slice(0, 600));
  if (!start.startsWith("<!doctype html><title>Redirecting to:")) return null;
  return start.match(/http-equiv="refresh" content="0;url=([^"]+)"/)?.[1] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The Worker answers before anything else, so it also keeps the docs on https.
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.href, 301);
    }
    const response = await env.ASSETS.fetch(request);

    if (response.status === 307) {
      const location = response.headers.get("location");
      if (location) return Response.redirect(new URL(location, url).href, 308);
    }

    // A moved page answers with the move itself.
    if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
      const target = await movedTo(response);
      if (target) return Response.redirect(new URL(withSlash(target), url).href, 308);
    }
    return response;
  },
};
