import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "takumi-js/response";
import { renderDefaultOG } from "#/modules/og/og.service";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get("title") || siteConfig.title;
        const subtitle = url.searchParams.get("subtitle") || "";
        const date = url.searchParams.get("date") || "";
        const author = url.searchParams.get("author") || siteConfig.author.name;
        const tags = url.searchParams.get("tags") || url.searchParams.get("category") || "Article";

        const tagList = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

        const ogNode = renderDefaultOG({
          title,
          subtitle,
          author,
          tags: tagList,
          date,
        });

        return new ImageResponse(ogNode as any, {
          width: 1200,
          height: 630,
          headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
