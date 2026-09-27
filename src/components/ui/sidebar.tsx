"use client";

import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { SidebarSimple } from "@phosphor-icons/react";

import { colors } from "./tokens.stylex";

/**
 * The shadcn/ui Sidebar, rebuilt on StyleX: the same parts (Provider, Sidebar, Header,
 * Content, Footer, Group, Menu, MenuButton, Trigger, Inset) with atomic, compile-time CSS.
 *
 * Desktop: a column that collapses to icons (Ctrl/⌘+B), remembered in a cookie so the
 * server renders it the same way. Mobile (< 768px): an off-canvas drawer. Which one shows
 * is decided by media queries, so the server and the first paint always agree.
 */

export const SIDEBAR_COOKIE = "sidebar_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SHORTCUT = "b";
const DESKTOP = "@media (min-width: 768px)";
const MOBILE_QUERY = "(max-width: 767px)";

type SidebarContextValue = {
  /** Desktop: expanded or collapsed to icons. */
  collapsed: boolean;
  /** Mobile: the drawer is open. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return context;
}

const styles = stylex.create({
  wrapper: { display: "flex", minHeight: "100svh", width: "100%" },

  // ── sidebar ────────────────────────────────────────────────────────────────
  sidebar: {
    backgroundColor: colors.sidebar,
    borderInlineEndColor: colors.sidebarBorder,
    borderInlineEndStyle: "solid",
    borderInlineEndWidth: "1px",
    color: colors.sidebarForeground,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100svh",
    insetBlockStart: 0,
    insetInlineStart: 0,
    overflow: "hidden",
    position: { default: "fixed", [DESKTOP]: "sticky" },
    // Only the mobile drawer animates (transform); the desktop collapse is instant.
    transitionDuration: "220ms",
    transitionProperty: "transform",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    width: { default: "17rem", [DESKTOP]: "15rem" },
    zIndex: 40,
  },
  collapsed: { width: { default: "17rem", [DESKTOP]: "3.5rem" } },
  mobileClosed: { transform: { default: "translateX(-100%)", [DESKTOP]: "none" } },
  mobileOpen: { transform: "none" },
  overlay: {
    backgroundColor: "rgb(0 0 0 / 45%)",
    borderStyle: "none",
    display: { default: "block", [DESKTOP]: "none" },
    inset: 0,
    position: "fixed",
    zIndex: 30,
  },

  header: { display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem" },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "0.5rem",
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
  },
  footer: {
    borderBlockStartColor: colors.sidebarBorder,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.5rem",
  },
  separator: {
    backgroundColor: colors.sidebarBorder,
    borderStyle: "none",
    height: "1px",
    marginBlock: 0,
    marginInline: "0.5rem",
  },

  group: {
    display: "flex",
    flexDirection: "column",
    paddingBlock: "0.25rem",
    paddingInline: "0.5rem",
  },
  groupLabel: {
    color: `color-mix(in oklab, ${colors.sidebarForeground} 60%, transparent)`,
    fontSize: "0.75rem",
    fontWeight: 500,
    height: "2rem",
    lineHeight: "2rem",
    overflow: "hidden",
    paddingInline: "0.625rem",
    whiteSpace: "nowrap",
  },
  groupLabelCollapsed: { opacity: { default: 1, [DESKTOP]: 0 } },

  menu: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  menuItem: { position: "relative" },
  menuButton: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": colors.sidebarAccent },
    borderRadius: "0.5rem",
    borderStyle: "none",
    color: { default: colors.sidebarForeground, ":hover": colors.sidebarAccentForeground },
    cursor: "pointer",
    display: "flex",
    fontFamily: "inherit",
    fontSize: "0.8125rem",
    fontWeight: 500,
    gap: "0.625rem",
    height: "2.125rem",
    outlineColor: colors.sidebarRing,
    outlineOffset: "1px",
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: "2px",
    overflow: "hidden",
    paddingInline: "0.625rem",
    textAlign: "start",
    textDecoration: "none",
    transitionDuration: "120ms",
    transitionProperty: "background-color, color",
    width: "100%",
  },
  menuButtonLarge: { height: "3rem", paddingInline: "0.5rem" },
  menuButtonActive: {
    backgroundColor: colors.sidebarAccent,
    color: colors.sidebarAccentForeground,
    fontWeight: 600,
  },
  menuIcon: {
    display: "inline-flex",
    flexShrink: 0,
    fontSize: "1.125rem",
    justifyContent: "center",
    width: "1.125rem",
  },
  label: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  labelCollapsed: { display: { default: "block", [DESKTOP]: "none" } },

  // ── main area ──────────────────────────────────────────────────────────────
  inset: {
    backgroundColor: colors.background,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: "100svh",
    minWidth: 0,
  },
  trigger: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderRadius: "0.5rem",
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: "1.125rem",
    height: "2rem",
    justifyContent: "center",
    outlineColor: colors.ring,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: "2px",
    width: "2rem",
  },
});

export function SidebarProvider({
  defaultOpen = true,
  shortcut = true,
  children,
}: {
  /** Desktop state on first render, e.g. from the sidebar_state cookie on the server. */
  defaultOpen?: boolean;
  /** Listen for Ctrl/⌘+B. Off for a sidebar shown as a picture (the landing preview). */
  shortcut?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);

  const toggle = React.useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setOpenMobile((value) => !value);
      return;
    }
    setOpen((value) => {
      document.cookie = `${SIDEBAR_COOKIE}=${!value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
      return !value;
    });
  }, []);

  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, shortcut]);

  const value = React.useMemo(
    () => ({ collapsed: !open, openMobile, setOpenMobile, toggle }),
    [open, openMobile, toggle],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div {...stylex.props(styles.wrapper)}>{children}</div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  label = "Sidebar",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const { collapsed, openMobile, setOpenMobile } = useSidebar();
  return (
    <>
      {openMobile && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setOpenMobile(false)}
          {...stylex.props(styles.overlay)}
        />
      )}
      <aside
        aria-label={label}
        data-state={collapsed ? "collapsed" : "expanded"}
        {...stylex.props(
          styles.sidebar,
          collapsed && styles.collapsed,
          openMobile ? styles.mobileOpen : styles.mobileClosed,
        )}
      >
        {children}
      </aside>
    </>
  );
}

type PartProps = { children?: React.ReactNode; style?: StyleXStyles };

export const SidebarHeader = ({ children, style }: PartProps) => (
  <div {...stylex.props(styles.header, style)}>{children}</div>
);

export const SidebarContent = ({ children, style }: PartProps) => (
  <div {...stylex.props(styles.content, style)}>{children}</div>
);

export const SidebarFooter = ({ children, style }: PartProps) => (
  <div {...stylex.props(styles.footer, style)}>{children}</div>
);

export const SidebarSeparator = () => <hr {...stylex.props(styles.separator)} />;

export const SidebarGroup = ({ children, style }: PartProps) => (
  <div {...stylex.props(styles.group, style)}>{children}</div>
);

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div {...stylex.props(styles.groupLabel, collapsed && styles.groupLabelCollapsed)}>
      {children}
    </div>
  );
}

export const SidebarMenu = ({ children }: { children: React.ReactNode }) => (
  <ul {...stylex.props(styles.menu)}>{children}</ul>
);

export const SidebarMenuItem = ({ children }: { children: React.ReactNode }) => (
  <li {...stylex.props(styles.menuItem)}>{children}</li>
);

/** Text that disappears when the desktop sidebar is collapsed to icons. */
export function SidebarLabel({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <span {...stylex.props(styles.label, collapsed && styles.labelCollapsed)}>{children}</span>
  );
}

export type SidebarMenuButtonProps = Omit<
  React.ComponentPropsWithRef<"button">,
  "children" | "className" | "style"
> & {
  icon?: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  size?: "default" | "lg";
  /** Shown as a tooltip while the sidebar is collapsed to icons. */
  tooltip?: string;
  /** Render as another element, e.g. <Link to="/queue" />. */
  render?: useRender.RenderProp;
};

export function SidebarMenuButton({
  icon,
  children,
  isActive = false,
  size = "default",
  tooltip,
  render,
  onClick,
  ...rest
}: SidebarMenuButtonProps) {
  const { collapsed, setOpenMobile } = useSidebar();
  const look = stylex.props(
    styles.menuButton,
    size === "lg" && styles.menuButtonLarge,
    isActive && styles.menuButtonActive,
  );
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        className: look.className,
        style: look.style,
        title: collapsed ? tooltip : undefined,
        "aria-current": isActive ? "page" : undefined,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          setOpenMobile(false);
        },
        children: (
          <>
            {icon && <span {...stylex.props(styles.menuIcon)}>{icon}</span>}
            {typeof children === "string" ? <SidebarLabel>{children}</SidebarLabel> : children}
          </>
        ),
      },
      rest,
    ),
  });
}

export function SidebarTrigger({ label = "Toggle sidebar" }: { label?: string }) {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (Ctrl/⌘ B)`}
      onClick={toggle}
      {...stylex.props(styles.trigger)}
    >
      <SidebarSimple weight="bold" />
    </button>
  );
}

export const SidebarInset = ({ children }: { children: React.ReactNode }) => (
  <div {...stylex.props(styles.inset)}>{children}</div>
);

/** The sidebar's navigation landmark (use in place of SidebarContent). */
export const SidebarNav = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <nav aria-label={label} {...stylex.props(styles.content)}>
    {children}
  </nav>
);
