import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

// The workspace pages redirect a crawler to the landing page; keep crawlers out of them. No
// trailing slash: "/publish/" would not match "/publish" itself.
const PRIVATE = ["/api/", "/publish", "/library", "/queue", "/channels", "/api-keys", "/settings"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const robots = `User-agent: *
Allow: /
${PRIVATE.map((path) => `Disallow: ${path}`).join("\n")}

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
