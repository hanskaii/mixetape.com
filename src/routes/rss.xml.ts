import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { desc, eq } from "drizzle-orm";
import { siteConfig } from "#/config/site";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export const Route = createFileRoute("/rss/xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const postsList = await db.query.posts.findMany({
            where: eq(posts.status, "published"),
            orderBy: [desc(posts.createdAt)],
            limit: 30,
          });

          const siteUrl = siteConfig.url;
          const buildDate = new Date().toUTCString();
          const feedTitle = `${siteConfig.name} | Blog & Articles Hub`;
          const feedDesc = `Technical articles, engineering guides, and deep dives from ${siteConfig.name}.`;
          const feedLink = `${siteUrl}/blog`;
          const selfRss = `${siteUrl}/rss.xml`;

          const itemsXml = postsList
            .map((post) => {
              const postUrl = `${siteUrl}/blog/${post.slug}`;
              const pubDate = new Date(post.createdAt).toUTCString();
              const cleanExcerpt =
                post.excerpt ||
                post.content
                  .replace(/<[^>]+>/g, " ")
                  .slice(0, 200)
                  .trim();

              return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${escapeXml(cleanExcerpt)}</description>
      <author>${escapeXml(post.author || siteConfig.author.name)}</author>
      <pubDate>${pubDate}</pubDate>
    </item>`;
            })
            .join("\n");

          const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${feedLink}</link>
    <description>${escapeXml(feedDesc)}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${selfRss}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

          return new Response(rssXml, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=1800, s-maxage=1800",
            },
          });
        } catch (error: any) {
          return new Response(`<error>${error.message}</error>`, {
            status: 500,
            headers: { "Content-Type": "application/xml" },
          });
        }
      },
    },
  },
});
