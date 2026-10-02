import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

// The public pages worth indexing; everything else sits behind sign-in. `updated` is when the
// page's content last changed — bump it with the page, never per request, or engines learn to
// ignore it.
const PAGES = [
  { path: "/", updated: "2026-10-02" },
  { path: "/pricing", updated: "2026-10-02" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = PAGES.map(
          ({ path, updated }) => `  <url>
    <loc>${siteConfig.url}${path}</loc>
    <lastmod>${updated}</lastmod>
  </url>`,
        ).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
