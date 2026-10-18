import { createFileRoute, Outlet, redirect, useLocation, useRouter } from "@tanstack/react-router";
import { WorkspaceLayout } from "#/components/layouts/workspace-layout";
import { PagePending } from "#/components/layouts/workspace-page";
import { workspaceAccessQuery } from "#/modules/billing/billing.fn";

// Every workspace page: signed-in only, inside the sidebar layout, and only with a plan.
// Without one, everything but Settings (profile, security, billing) goes to /subscribe.
export const Route = createFileRoute("/(app)/_app")({
  beforeLoad: async ({ context, location }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
    if (location.pathname.startsWith("/settings")) return;
    // A kept answer is used at once and checked again behind the page once it is stale.
    const { allowed } = await context.queryClient.ensureQueryData({
      ...workspaceAccessQuery,
      revalidateIfStale: true,
    });
    if (allowed) return;
    // Not kept: /subscribe sends them back here as soon as a plan arrives.
    context.queryClient.removeQueries({ queryKey: workspaceAccessQuery.queryKey });
    throw redirect({ to: "/subscribe" });
  },
  component: WorkspaceRoute,
  // Only on the way in (from the landing page, say): the sidebar is already up, with the
  // page's own pending view in it, rather than one placeholder for the whole screen.
  pendingComponent: WorkspacePending,
});

function WorkspacePending() {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [, , page] = router.getMatchedRoutes(pathname);
  const Pending = page?.options.pendingComponent;
  return <WorkspaceLayout>{Pending ? <Pending /> : <PagePending />}</WorkspaceLayout>;
}

function WorkspaceRoute() {
  return (
    <WorkspaceLayout>
      <Outlet />
    </WorkspaceLayout>
  );
}
