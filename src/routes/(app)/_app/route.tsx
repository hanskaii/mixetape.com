import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { WorkspaceLayout } from "#/components/layouts/workspace-layout";
import { workspaceAccessQuery } from "#/modules/billing/billing.fn";

// Every workspace page: signed-in only, inside the sidebar layout, and only with a plan.
// Without one, everything but Settings (profile, security, billing) goes to /subscribe.
export const Route = createFileRoute("/(app)/_app")({
  beforeLoad: async ({ context, location }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
    if (location.pathname.startsWith("/settings")) return;
    const { allowed } = await context.queryClient.fetchQuery(workspaceAccessQuery);
    if (allowed) return;
    // Not kept: /subscribe sends them back here as soon as a plan arrives.
    context.queryClient.removeQueries({ queryKey: workspaceAccessQuery.queryKey });
    throw redirect({ to: "/subscribe" });
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}
