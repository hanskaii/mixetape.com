import { markdownRoute } from "@cloudflare/nimbus-docs/agent-endpoints";
import { withoutTagPagesRoute } from "@/lib/api-overview";

export const prerender = true;
// The API overview's Markdown lists the groups' operations instead of tag pages.
export const GET = withoutTagPagesRoute(markdownRoute().GET);

// The Markdown version of every page, less the API tag pages, which the site does not
// build (see src/pages/api/[...slug].astro).
export async function getStaticPaths(context: Parameters<ReturnType<typeof markdownRoute>["getStaticPaths"]>[0]) {
  const paths = await markdownRoute().getStaticPaths(context);
  return paths.filter((path) => !String(path.params.slug ?? "").startsWith("api/tags/"));
}
