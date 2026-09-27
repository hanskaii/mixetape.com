import type { ReactNode } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import {
  CalendarDots,
  CaretUpDown,
  Gear,
  Key,
  PlugsConnected,
  Robot,
  ShieldCheck,
  SignOut,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { colors } from "../ui/tokens.stylex";
import { authClient } from "#/modules/auth/auth-client";
import { Route as RootRoute } from "#/routes/__root";
import ThemeToggle from "./theme-toggle";

/**
 * The workspace: where people supervise what their agents schedule. A sidebar for the few
 * pages there are, and a thin top bar; no composer, since posts arrive through MCP / API.
 */

const WORKSPACE = [
  { to: "/queue", label: "Queue", icon: CalendarDots },
  { to: "/channels", label: "Channels", icon: PlugsConnected },
  { to: "/api-keys", label: "API keys", icon: Key },
] as const;

const ACCOUNT = [
  { to: "/settings/profile", label: "Profile", icon: Gear },
  { to: "/settings/account", label: "Security", icon: ShieldCheck },
] as const;

const PAGES = [...WORKSPACE, ...ACCOUNT];

const styles = stylex.create({
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
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: "0.5rem",
    color: colors.primaryForeground,
    display: "flex",
    flexShrink: 0,
    fontSize: "0.75rem",
    fontWeight: 700,
    height: "2rem",
    justifyContent: "center",
    objectFit: "cover",
    overflow: "hidden",
    width: "2rem",
  },
  who: { display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 },
  whoName: { fontSize: "0.8125rem", fontWeight: 600 },
  whoEmail: { color: colors.mutedForeground, fontSize: "0.7rem" },
  topbar: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 88%, transparent)`,
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    display: "flex",
    gap: "0.5rem",
    height: "3rem",
    insetBlockStart: 0,
    paddingInline: "0.75rem",
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

function UserMenu() {
  const router = useRouter();
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;
  if (!user) return null;
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={user.email}
            icon={
              user.image ? (
                <img src={user.image} alt="" {...stylex.props(styles.avatar)} />
              ) : (
                <span {...stylex.props(styles.avatar)}>{initial}</span>
              )
            }
          >
            <SidebarLabel>
              <span {...stylex.props(styles.who)}>
                <span {...stylex.props(styles.whoName)}>{user.name || "You"}</span>
                <span {...stylex.props(styles.whoEmail)}>{user.email}</span>
              </span>
            </SidebarLabel>
            <SidebarLabel>
              <CaretUpDown />
            </SidebarLabel>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem render={<Link to="/settings/profile" />}>
          <Gear /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/settings/account" />}>
          <ShieldCheck /> Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await authClient.signOut();
            await router.navigate({ to: "/" });
            await router.invalidate();
          }}
        >
          <SignOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
              tooltip={name}
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
  defaultOpen,
  activePath,
  preview = false,
  children,
}: {
  defaultOpen: boolean;
  /** The page shown as current; defaults to the browser's location. */
  activePath?: string;
  /** Rendered as a picture of the workspace (landing page): no keyboard shortcut. */
  preview?: boolean;
  children: ReactNode;
}) {
  const location = useLocation();
  const pathname = activePath ?? location.pathname;
  const current = PAGES.find((page) => pathname.startsWith(page.to));

  return (
    <SidebarProvider defaultOpen={defaultOpen} shortcut={!preview}>
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
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
        </header>
        <main {...stylex.props(styles.main)}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
