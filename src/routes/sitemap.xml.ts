import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { desc, eq } from "drizzle-orm";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = siteConfig.url;
        const now = new Date().toISOString().split("T")[0];

        const staticRoutes = [
          { path: "", priority: "1.0", changefreq: "daily" },
          { path: "/blog", priority: "0.9", changefreq: "daily" },
          { path: "/about", priority: "0.8", changefreq: "weekly" },
        ];

        const publishedPosts = await db.query.posts.findMany({
          where: eq(posts.status, "published"),
          orderBy: [desc(posts.updatedAt)],
        });

        const staticUrlsXml = staticRoutes
          .map(
            (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
          )
          .join("\n");

        const postsUrlsXml = publishedPosts
          .map((post) => {
            const lastMod = new Date(post.updatedAt || post.createdAt).toISOString().split("T")[0];
            return `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrlsXml}
${postsUrlsXml}
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
