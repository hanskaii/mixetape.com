import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { CalendarDots, Gear, Key, PlugsConnected, Robot, ShieldCheck } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarNav,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { colors } from "../ui/tokens.stylex";
import { Route as RootRoute } from "#/routes/__root";
import { HeaderUser } from "./header-user";
import ThemeToggle from "./theme-toggle";

/**
 * The workspace: where people supervise what their agents schedule. The same bordered
 * column as the public site, holding a sidebar for the few pages there are and a thin top
 * bar with the account menu; no composer, since posts arrive through MCP / API.
 */

const WORKSPACE = [
  { to: "/publish", label: "Publish", icon: CalendarDots },
  { to: "/channels", label: "Channels", icon: PlugsConnected },
  { to: "/api-keys", label: "API keys", icon: Key },
] as const;

const ACCOUNT = [
  { to: "/settings/profile", label: "Profile", icon: Gear },
  { to: "/settings/account", label: "Security", icon: ShieldCheck },
] as const;

const PAGES = [...WORKSPACE, ...ACCOUNT];

const MD = "@media (min-width: 768px)";

const styles = stylex.create({
  // The public site's column (routes/(public)/route.tsx): centred, bordered on wide screens.
  shell: {
    borderInlineColor: colors.border,
    borderInlineStyle: "solid",
    borderInlineWidth: { default: 0, [MD]: "1px" },
    marginInline: "auto",
    maxWidth: "80rem",
  },
  brand: {
    alignItems: "center",
    color: colors.sidebarForeground,
    display: "flex",
    gap: "0.625rem",
    height: "2.25rem",
    paddingInline: "0.3rem",
    textDecoration: "none",
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.sidebarPrimary,
    borderRadius: "0.5rem",
    color: colors.sidebarPrimaryForeground,
    display: "flex",
    flexShrink: 0,
    fontSize: "1rem",
    fontWeight: 800,
    height: "1.75rem",
    justifyContent: "center",
    letterSpacing: "-0.06em",
    width: "1.75rem",
  },
  brandName: { fontSize: "1.0625rem", fontWeight: 700, letterSpacing: "-0.06em" },
  topbar: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 88%, transparent)`,
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    display: "flex",
    gap: "0.5rem",
    // Level with the sidebar's brand row.
    height: "3.75rem",
    insetBlockStart: 0,
    // The same inset as the page under it (workspace-page.tsx).
    paddingInline: { default: "1rem", [MD]: "1.75rem" },
    position: "sticky",
    zIndex: 20,
  },
  crumb: { color: colors.mutedForeground, fontSize: "0.8125rem" },
  crumbCurrent: { color: colors.foreground, fontWeight: 600 },
  spacer: { flexGrow: 1 },
  main: { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 },
  agentsLink: {
    alignItems: "center",
    borderRadius: "0.5rem",
    color: colors.mutedForeground,
    display: { default: "none", "@media (min-width: 640px)": "inline-flex" },
    fontSize: "0.75rem",
    gap: "0.375rem",
    paddingBlock: "0.375rem",
    paddingInline: "0.5rem",
    textDecoration: { default: "none", ":hover": "underline" },
  },
});

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: readonly (typeof PAGES)[number][];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(({ to, label: name, icon: Icon }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              render={<Link to={to} />}
              icon={<Icon weight={pathname.startsWith(to) ? "fill" : "regular"} />}
              isActive={pathname.startsWith(to)}
            >
              {name}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function WorkspaceLayout({
  activePath,
  children,
}: {
  /** The page shown as current; defaults to the browser's location. */
  activePath?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  // Signed out only in the landing page's picture of the workspace, which shows no account.
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  const pathname = activePath ?? location.pathname;
  const current = PAGES.find((page) => pathname.startsWith(page.to));

  return (
    <SidebarProvider style={styles.shell}>
      <Sidebar label="Workspace">
        <SidebarHeader>
          <Link to="/" {...stylex.props(styles.brand)}>
            <span {...stylex.props(styles.mark)}>m</span>
            <SidebarLabel>
              <span {...stylex.props(styles.brandName)}>mixetape</span>
            </SidebarLabel>
          </Link>
        </SidebarHeader>
        <SidebarNav label="Workspace">
          <NavGroup label="Workspace" items={WORKSPACE} pathname={pathname} />
          <NavGroup label="Account" items={ACCOUNT} pathname={pathname} />
        </SidebarNav>
      </Sidebar>

      <SidebarInset>
        <header {...stylex.props(styles.topbar)}>
          <SidebarTrigger />
          <span {...stylex.props(styles.crumb)}>
            Workspace / <span {...stylex.props(styles.crumbCurrent)}>{current?.label}</span>
          </span>
          <span {...stylex.props(styles.spacer)} />
          <a href="/#agents" {...stylex.props(styles.agentsLink)}>
            <Robot /> Connect an agent
          </a>
          <ThemeToggle />
          {signedIn && <HeaderUser />}
        </header>
        <main {...stylex.props(styles.main)}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
