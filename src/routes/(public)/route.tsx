import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import * as stylex from "@stylexjs/stylex";
import Footer from "#/components/layouts/footer";
import { AppHeader } from "#/components/layouts/app-header";
import { colors } from "../../components/ui/tokens.stylex";
import { Route as RootRoute } from "#/routes/__root";

// The public site: landing page, privacy and the connect callback, in one bordered column
// with the site header and footer.
export const Route = createFileRoute("/(public)")({
  component: PublicLayout,
});

const styles = stylex.create({
  shell: {
    borderInlineColor: colors.border,
    borderInlineStyle: "solid",
    borderInlineWidth: { default: 0, "@media (min-width: 768px)": "1px" },
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    marginInline: "auto",
    maxWidth: "80rem",
    minHeight: "100vh",
    width: "100%",
  },
  body: { flexGrow: 1 },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
    paddingBlock: { default: "1.5rem", "@media (min-width: 768px)": "2rem" },
    paddingInline: "1rem",
  },
});

function PublicLayout() {
  const router = useRouter();
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  // Someone signed in is likely to open the workspace from here. Its layout chunk carries the
  // workspace's pending view (sidebar and the page's skeleton): fetched as soon as this page
  // has loaded, so the first click shows that rather than a bare placeholder.
  useEffect(() => {
    if (!signedIn) return;
    const preload = () => {
      void router.loadRouteChunk(router.routesById["/(app)/_app"]);
      void router.loadRouteChunk(router.routesById["/(app)/_app/publish/"]);
    };
    if (document.readyState === "complete") preload();
    else window.addEventListener("load", preload, { once: true });
    return () => window.removeEventListener("load", preload);
  }, [router, signedIn]);
  return (
    <div {...stylex.props(styles.shell)}>
      <AppHeader />
      <div {...stylex.props(styles.body)}>
        <main {...stylex.props(styles.main)}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
