import { llmsRoute } from "@cloudflare/nimbus-docs/agent-endpoints";
import { withoutTagPagesRoute } from "@/lib/api-overview";

export const prerender = true;
// Without the API tag pages, which the site does not build.
export const GET = withoutTagPagesRoute(llmsRoute().GET);
