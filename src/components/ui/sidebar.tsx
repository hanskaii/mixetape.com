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
 * Group, Menu, MenuButton, Trigger, Inset) with atomic, compile-time CSS.
 *
 * Desktop: a column that is always open. Mobile (< 768px): an off-canvas drawer, opened by
 * the trigger — the only place the trigger shows. Which one shows is decided by media
 * queries, so the server and the first paint always agree.
 */

const DESKTOP = "@media (min-width: 768px)";

type SidebarContextValue = {
  /** Mobile: the drawer is open. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar(): SidebarContextValue {
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
    // The mobile drawer slides in.
    transitionDuration: "220ms",
    transitionProperty: "transform",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    width: { default: "17rem", [DESKTOP]: "15rem" },
    zIndex: 40,
  },
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
    display: { default: "inline-flex", [DESKTOP]: "none" },
    flexShrink: 0,
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
  style,
  children,
}: {
  /** Extra styles for the wrapper, e.g. the page's bordered column. */
  style?: StyleXStyles;
  children: React.ReactNode;
}) {
  const [openMobile, setOpenMobile] = React.useState(false);
  const value = React.useMemo(() => ({ openMobile, setOpenMobile }), [openMobile]);

  return (
    <SidebarContext.Provider value={value}>
      <div {...stylex.props(styles.wrapper, style)}>{children}</div>
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
  const { openMobile, setOpenMobile } = useSidebar();
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
        {...stylex.props(styles.sidebar, openMobile ? styles.mobileOpen : styles.mobileClosed)}
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

export const SidebarGroup = ({ children, style }: PartProps) => (
  <div {...stylex.props(styles.group, style)}>{children}</div>
);

export const SidebarGroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div {...stylex.props(styles.groupLabel)}>{children}</div>
);

export const SidebarMenu = ({ children }: { children: React.ReactNode }) => (
  <ul {...stylex.props(styles.menu)}>{children}</ul>
);

export const SidebarMenuItem = ({ children }: { children: React.ReactNode }) => (
  <li {...stylex.props(styles.menuItem)}>{children}</li>
);

/** A menu button's text, truncated when it does not fit. */
export const SidebarLabel = ({ children }: { children: React.ReactNode }) => (
  <span {...stylex.props(styles.label)}>{children}</span>
);

export type SidebarMenuButtonProps = Omit<
  React.ComponentPropsWithRef<"button">,
  "children" | "className" | "style"
> & {
  icon?: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  /** Render as another element, e.g. <Link to="/publish" />. */
  render?: useRender.RenderProp;
};

export function SidebarMenuButton({
  icon,
  children,
  isActive = false,
  render,
  onClick,
  ...rest
}: SidebarMenuButtonProps) {
  const { setOpenMobile } = useSidebar();
  const look = stylex.props(styles.menuButton, isActive && styles.menuButtonActive);
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        className: look.className,
        style: look.style,
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

/** Opens the mobile drawer; hidden on desktop, where the sidebar is always open. */
export function SidebarTrigger({ label = "Open menu" }: { label?: string }) {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={openMobile}
      onClick={() => setOpenMobile(!openMobile)}
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
