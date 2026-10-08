import { siteConfig } from "#/config/site";

const SITE = new URL(siteConfig.url);

/** Paths whose exact form a client relies on (APIs, OAuth discovery): left as they come. */
const AS_IS = ["/api/", "/.well-known/", "/mcp", "/oauth/"];

/**
 * One address per page, permanently: https, the bare domain (www goes to it) and no
 * trailing slash. Only for mixetape's own hosts, so local development is untouched; only
 * GET and HEAD lose a trailing slash, so no request body is ever dropped by a redirect.
 */
export function canonicalRedirect(request: Request, url: URL): Response | null {
  const ours = url.hostname === SITE.hostname || url.hostname === `www.${SITE.hostname}`;
  if (!ours) return null;
  const target = new URL(url);
  target.protocol = SITE.protocol;
  target.hostname = SITE.hostname;
  const readable = request.method === "GET" || request.method === "HEAD";
  if (
    readable &&
    target.pathname.length > 1 &&
    target.pathname.endsWith("/") &&
    !AS_IS.some((prefix) => target.pathname.startsWith(prefix))
  )
    target.pathname = target.pathname.replace(/\/+$/, "");
  if (target.href === url.href) return null;
  // 301 for http and www (any method keeps working on https for clients that follow), 308 for
  // the slash, which keeps the method.
  return Response.redirect(
    target.href,
    url.protocol !== target.protocol || url.hostname !== target.hostname ? 301 : 308,
  );
}
