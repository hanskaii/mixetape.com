import { Link, useLocation } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { ArrowRight } from "@phosphor-icons/react";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { colors } from "../ui/tokens.stylex";
import { HeaderUser } from "./header-user";
import { Rule } from "./rule";
import ThemeToggle from "./theme-toggle";

const SM = "@media (min-width: 640px)";
const MD = "@media (min-width: 768px)";

const styles = stylex.create({
  header: {
    backdropFilter: "blur(12px) saturate(1.5)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 80%, transparent)`,
    paddingBlock: "0.75rem",
    paddingInline: "1rem",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  nav: {
    alignItems: "center",
    display: "flex",
    gap: "1rem",
    justifyContent: "space-between",
  },
  // The landing page centres its section links between the name and the account.
  navLanding: {
    display: "grid",
    gridTemplateColumns: { default: "1fr auto", [SM]: "1fr auto 1fr" },
  },
  brand: {
    alignItems: "center",
    color: colors.foreground,
    display: "flex",
    flexShrink: 0,
    fontSize: "23px",
    fontWeight: 700,
    letterSpacing: "-0.07em",
    textDecoration: "none",
  },
  sections: { alignItems: "center", display: { default: "none", [SM]: "flex" }, gap: "0.5rem" },
  section: {
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderRadius: "0.5rem",
    color: colors.foreground,
    fontSize: "13px",
    fontWeight: 500,
    paddingBlock: "0.5rem",
    paddingInline: "0.75rem",
    textDecoration: "none",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
  actions: { alignItems: "center", display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
  workspace: {
    alignItems: "center",
    backgroundColor: {
      default: colors.primary,
      ":hover": `color-mix(in oklab, ${colors.primary} 80%, transparent)`,
    },
    borderRadius: "0.5rem",
    color: colors.primaryForeground,
    display: { default: "none", [MD]: "inline-flex" },
    fontSize: "13px",
    fontWeight: 600,
    gap: "0.375rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.75rem",
    textDecoration: "none",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
});

export function AppHeader() {
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;
  const isLanding = useLocation().pathname === "/";

  return (
    <header {...stylex.props(styles.header)}>
      <nav
        aria-label="Main navigation"
        {...stylex.props(styles.nav, isLanding && styles.navLanding)}
      >
        <Link to="/" {...stylex.props(styles.brand)}>
          {siteConfig.name}
        </Link>

        {isLanding && (
          <div {...stylex.props(styles.sections)}>
            <a href="/#how" {...stylex.props(styles.section)}>
              How it works
            </a>
            <a href="/#agents" {...stylex.props(styles.section)}>
              For agents
            </a>
            <Link to="/pricing" {...stylex.props(styles.section)}>
              Pricing
            </Link>
          </div>
        )}

        <div {...stylex.props(styles.actions)}>
          {user && (
            <Link to="/publish" {...stylex.props(styles.workspace)}>
              Workspace <ArrowRight size={16} />
            </Link>
          )}
          <HeaderUser />
          <ThemeToggle />
        </div>
      </nav>
      <Rule position="bottom" />
    </header>
  );
}
