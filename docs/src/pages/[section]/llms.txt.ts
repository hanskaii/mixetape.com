import { llmsSectionRoute } from "@cloudflare/nimbus-docs/agent-endpoints";
import { withoutTagPagesRoute } from "@/lib/api-overview";

export const prerender = true;
const route = llmsSectionRoute();
export const getStaticPaths = route.getStaticPaths;
// Without the API tag pages, which the site does not build.
export const GET = withoutTagPagesRoute(route.GET);
