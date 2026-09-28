import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { WorkspaceLayout } from "#/components/layouts/workspace-layout";

// Every workspace page: signed-in only, inside the sidebar layout.
export const Route = createFileRoute("/(app)/_app")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
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
