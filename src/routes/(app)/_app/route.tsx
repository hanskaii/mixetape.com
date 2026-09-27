import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { WorkspaceLayout } from "#/components/layouts/workspace-layout";
import { SIDEBAR_COOKIE } from "#/components/ui/sidebar";

/** Whether the desktop sidebar is expanded, from its cookie — so the server renders it right. */
const sidebarOpen = createIsomorphicFn()
  .server(() => getCookie(SIDEBAR_COOKIE) !== "false")
  .client(() => !document.cookie.includes(`${SIDEBAR_COOKIE}=false`));

// Every workspace page: signed-in only, inside the sidebar layout.
export const Route = createFileRoute("/(app)/_app")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
  },
  loader: () => ({ sidebarOpen: sidebarOpen() }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { sidebarOpen: open } = Route.useLoaderData();
  return (
    <WorkspaceLayout defaultOpen={open}>
      <Outlet />
    </WorkspaceLayout>
  );
}
