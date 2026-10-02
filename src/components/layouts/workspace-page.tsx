import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { colors } from "../ui/tokens.stylex";

/**
 * The building blocks of a workspace page: a compact header, panels of rows, empty
 * states and notices. The workspace is for supervising what agents do, so pages are
 * dense lists rather than forms.
 */

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    marginInline: "auto",
    maxWidth: "68rem",
    paddingBlock: { default: "1rem", "@media (min-width: 768px)": "1.5rem" },
    paddingInline: { default: "1rem", "@media (min-width: 768px)": "1.75rem" },
    width: "100%",
  },
  header: {
    alignItems: { default: "flex-start", "@media (min-width: 640px)": "flex-end" },
    display: "flex",
    flexDirection: { default: "column", "@media (min-width: 640px)": "row" },
    gap: "0.75rem",
    justifyContent: "space-between",
  },
  title: {
    color: colors.foreground,
    fontSize: "1.375rem",
    fontWeight: 600,
    letterSpacing: "-0.035em",
    lineHeight: 1.15,
    margin: 0,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    marginBlockEnd: 0,
    marginBlockStart: "0.25rem",
    maxWidth: "42rem",
  },
  actions: { alignItems: "center", display: "flex", flexShrink: 0, gap: "0.5rem" },

  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "0.875rem",
    borderStyle: "solid",
    borderWidth: "1px",
    overflow: "hidden",
  },
  panelHeader: {
    alignItems: "center",
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    display: "flex",
    gap: "0.5rem",
    minHeight: "2.75rem",
    paddingInline: "0.875rem",
  },
  panelTitle: { flexGrow: 1, fontSize: "0.8125rem", fontWeight: 600, margin: 0 },
  count: { color: colors.mutedForeground, fontFamily: MONO, fontSize: "0.7rem" },

  rows: { listStyle: "none", margin: 0, padding: 0 },
  // Phones: status and actions drop under the title so the title keeps the full width.
  row: {
    alignItems: "center",
    borderBlockStartColor: { default: colors.border, ":first-child": "transparent" },
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    columnGap: "0.75rem",
    display: "grid",
    minHeight: "3.25rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.875rem",
    rowGap: "0.375rem",
  },
  withLead: {
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr)",
      "@media (min-width: 640px)": "auto minmax(0, 1fr) auto",
    },
  },
  noLead: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 640px)": "minmax(0, 1fr) auto",
    },
  },
  lead: { gridRow: { default: "span 2", "@media (min-width: 640px)": "auto" } },
  trailing: {
    alignItems: "center",
    display: "flex",
    gap: "0.75rem",
    justifyContent: { default: "flex-start", "@media (min-width: 640px)": "flex-end" },
  },

  rowMain: { display: "flex", flexDirection: "column", flexGrow: 1, gap: "0.125rem", minWidth: 0 },
  rowTitle: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    // Phones: a title wraps rather than shrinking to a few characters.
    whiteSpace: { default: "normal", "@media (min-width: 640px)": "nowrap" },
  },
  rowMeta: {
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowError: { color: colors.destructive, fontSize: "0.75rem", margin: 0 },

  empty: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    lineHeight: 1.6,
    margin: 0,
    paddingBlock: "1.75rem",
    paddingInline: "1rem",
    textAlign: "center",
  },
  notice: {
    alignItems: "center",
    borderRadius: "0.75rem",
    display: "flex",
    fontSize: "0.8125rem",
    gap: "0.5rem",
    margin: 0,
    paddingBlock: "0.625rem",
    paddingInline: "0.875rem",
  },
  success: { backgroundColor: "color-mix(in oklab, #10b981 12%, transparent)", color: "#047857" },
  danger: {
    backgroundColor: `color-mix(in oklab, ${colors.destructive} 12%, transparent)`,
    color: colors.destructive,
  },
  info: { backgroundColor: colors.muted, color: colors.foreground },
  mono: { fontFamily: MONO, fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" },
});

export const Page = ({ children }: { children: ReactNode }) => (
  <div {...stylex.props(styles.page)}>{children}</div>
);

/**
 * The heading level of a page title. A workspace page shown inside another page (the landing
 * page's preview) sets it to "h2", so that page keeps a single h1.
 */
export const PageTitleLevel = createContext<"h1" | "h2">("h1");

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const Title = useContext(PageTitleLevel);
  return (
    <header {...stylex.props(styles.header)}>
      <div>
        <Title {...stylex.props(styles.title)}>{title}</Title>
        {description && <p {...stylex.props(styles.description)}>{description}</p>}
      </div>
      {actions && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </header>
  );
}

export function Panel({
  icon,
  title,
  count,
  actions,
  children,
}: {
  /** A mark before the title, e.g. the platform's logo. */
  icon?: ReactNode;
  title?: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.panel)}>
      {title && (
        <div {...stylex.props(styles.panelHeader)}>
          {icon}
          <h2 {...stylex.props(styles.panelTitle)}>{title}</h2>
          {count !== undefined && <span {...stylex.props(styles.count)}>{count}</span>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const Rows = ({ children }: { children: ReactNode }) => (
  <ul {...stylex.props(styles.rows)}>{children}</ul>
);

/** One line of a panel: an optional leading element, title and meta, then trailing items. */
export function Row({
  leading,
  title,
  meta,
  error,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  error?: string | null;
  children?: ReactNode;
}) {
  return (
    <li {...stylex.props(styles.row, leading ? styles.withLead : styles.noLead)}>
      {leading && <div {...stylex.props(styles.lead)}>{leading}</div>}
      <div {...stylex.props(styles.rowMain)}>
        <p {...stylex.props(styles.rowTitle)}>{title}</p>
        {meta && <p {...stylex.props(styles.rowMeta)}>{meta}</p>}
        {error && <p {...stylex.props(styles.rowError)}>{error}</p>}
      </div>
      {children && <div {...stylex.props(styles.trailing)}>{children}</div>}
    </li>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p {...stylex.props(styles.empty)}>{children}</p>
);

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  return <p {...stylex.props(styles.notice, styles[tone])}>{children}</p>;
}

/**
 * A time in the reader's own time zone. The server does not know it, so the text is set
 * after hydration (the ISO time is in the markup until then) and never mismatches.
 */
export function LocalTime({
  date,
  format,
}: {
  date: Date | string | number;
  format: Intl.DateTimeFormatOptions;
}) {
  const iso = new Date(date).toISOString();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Intl.DateTimeFormat(undefined, format).format(new Date(iso)));
  }, [iso, format]);
  return <time dateTime={iso}>{text ?? "\u00a0"}</time>;
}

export const Mono = ({ children, style }: { children: ReactNode; style?: StyleXStyles }) => (
  <span {...stylex.props(styles.mono, style)}>{children}</span>
);
