import handler from "@tanstack/react-start/server-entry";

// Workflows are classes exported from the Worker entry; wrangler.jsonc binds this one.
export { PublishWorkflow } from "./modules/social/publish.workflow";

const VISITOR_ID_COOKIE = "_lo_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function generateVisitorId(): string {
  return crypto.randomUUID();
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const matches = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return matches ? decodeURIComponent(matches[1]) : null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const url = new URL(request.url);
      const cookieHeader = request.headers.get("cookie");
      let visitorId = getCookieValue(cookieHeader, VISITOR_ID_COOKIE);
      let needsSetCookie = false;

      if (!visitorId) {
        visitorId = generateVisitorId();
        needsSetCookie = true;
      }

      if (url.pathname === "/api/track" && request.method === "POST") {
        try {
          const payload = (await request.json().catch(() => ({}))) as {
            slug?: string;
            postId?: number;
          };

          const key = payload.postId
            ? `analytics:views:${payload.postId}`
            : payload.slug
              ? `analytics:views:${payload.slug}`
              : null;

          if (key && env.KIT_CACHE) {
            const current = Number(await env.KIT_CACHE.get(key)) || 0;
            ctx.waitUntil(env.KIT_CACHE.put(key, String(current + 1)));
          }

          const res = new Response(null, { status: 204 });
          if (needsSetCookie) {
            res.headers.set(
              "Set-Cookie",
              `${VISITOR_ID_COOKIE}=${visitorId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
            );
          }
          return res;
        } catch {
          return new Response(null, { status: 204 });
        }
      }

      if (url.pathname === "/rss.xml" || url.pathname === "/rss/xml") {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = "/rss/xml";
        const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
        return await (handler.fetch as any)(rewrittenRequest, env, ctx);
      }

      if (url.pathname === "/sitemap.xml" || url.pathname === "/sitemap/xml") {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = "/sitemap/xml";
        const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
        return await (handler.fetch as any)(rewrittenRequest, env, ctx);
      }

      if (url.pathname === "/robots.txt" || url.pathname === "/robots/txt") {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = "/robots/txt";
        const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
        return await (handler.fetch as any)(rewrittenRequest, env, ctx);
      }

      if (url.pathname.startsWith("/@")) {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = "/" + url.pathname.slice(2);
        const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
        return await (handler.fetch as any)(rewrittenRequest, env, ctx);
      }

      const response = (await (handler.fetch as any)(request, env, ctx)) as Response;

      if (needsSetCookie && response && response.headers) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.append(
          "Set-Cookie",
          `${VISITOR_ID_COOKIE}=${visitorId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        );
        return newResponse;
      }

      return response;
    } catch (err: any) {
      console.error("[Worker fetch error]:", err?.stack || err);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
};
