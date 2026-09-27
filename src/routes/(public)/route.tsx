import { createFileRoute, Outlet } from "@tanstack/react-router";
import Footer from "#/components/layouts/footer";
import { AppHeader } from "#/components/layouts/app-header";

// The public site: landing page and the connect callback, with the site header and footer.
export const Route = createFileRoute("/(public)")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1510px] flex-col justify-start">
      <AppHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
