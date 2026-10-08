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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);

    if (response.status === 307) {
      const location = response.headers.get("location");
      if (location) return Response.redirect(new URL(location, url).href, 308);
    }

    // A moved page is a tiny HTML file with a meta refresh: answer with the move itself.
    const size = Number(response.headers.get("content-length") ?? Infinity);
    if (response.ok && size < 1024 && response.headers.get("content-type")?.includes("text/html")) {
      const html = await response.clone().text();
      const target = html.match(/http-equiv="refresh" content="0;url=([^"]+)"/)?.[1];
      if (target) return Response.redirect(new URL(withSlash(target), url).href, 308);
    }
    return response;
  },
};
