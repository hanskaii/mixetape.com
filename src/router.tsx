import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getQueryContext } from "./modules/query/query-client";
import { PagePending } from "./components/layouts/workspace-page";

export function getRouter() {
  const context = getQueryContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Without these the old page stays up, under the new URL, until the next one's loader
    // returns: a second or more from far away.
    defaultPendingComponent: PagePending,
    defaultPendingMs: 100,
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
