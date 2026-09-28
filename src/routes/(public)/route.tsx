import { createFileRoute, Outlet } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import Footer from "#/components/layouts/footer";
import { AppHeader } from "#/components/layouts/app-header";
import { colors } from "../../components/ui/tokens.stylex";

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
