import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/robots/txt")({
  server: {
    handlers: {
      GET: () => {
        const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard/
Disallow: /settings/

Sitemap: ${siteConfig.url}/sitemap.xml
`;
        return new Response(robots, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
