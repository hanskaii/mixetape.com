import { getOgImagePages } from "@cloudflare/nimbus-docs/runtime";
import { OGImageRoute } from "astro-og-canvas";
import { ogCardConfig } from "./_og-card-config";

// Prerender every OG card as a static asset so `output: "server"` doesn't
// turn image generation into an on-demand route.
export const prerender = true;

// One card per page, written at the page's `ogImageUrl`.
export const { getStaticPaths, GET } = await OGImageRoute({
  // Not for the API tag pages, which the site does not build.
  pages: Object.fromEntries(
    Object.entries(await getOgImagePages()).filter(([path]) => !path.includes("api/tags/")),
  ),
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description ?? "",
    ...ogCardConfig,
  }),
});
