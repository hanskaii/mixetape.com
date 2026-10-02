import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { PlugsConnected, WarningCircle } from "@phosphor-icons/react";
import { colors } from "../../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

export const styles = stylex.create({
  wrap: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: { default: "2rem", "@media (min-width: 768px)": "4rem" },
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 18px 48px -40px rgba(35, 25, 8, 0.35)",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    maxWidth: "30rem",
    padding: { default: "1.5rem", "@media (min-width: 640px)": "2rem" },
    width: "100%",
  },
  mark: {
    alignItems: "center",
    backgroundColor: "#ffd337",
    borderRadius: "12px",
    color: "#11110f",
    display: "flex",
    height: "2.75rem",
    justifyContent: "center",
    width: "2.75rem",
  },
  eyebrow: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    marginBlock: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    marginBlockEnd: 0,
    marginBlockStart: "0.5rem",
  },
  app: { color: colors.editorial },
  text: { color: colors.mutedForeground, fontSize: "0.875rem", lineHeight: 1.6, margin: 0 },
  strong: { color: colors.foreground, fontWeight: 500 },
  scopes: {
    borderBlockColor: colors.border,
    borderBlockStyle: "solid",
    borderBlockWidth: "1px",
    borderInlineStyle: "none",
    display: "grid",
    gap: "0.625rem",
    margin: 0,
    paddingBlock: "1rem",
    paddingInline: 0,
  },
  legend: { fontSize: "0.8125rem", fontWeight: 600, paddingBlockEnd: "0.75rem" },
  scope: { alignItems: "flex-start", display: "flex", fontSize: "0.8125rem", gap: "0.5rem" },
  checkbox: {
    accentColor: colors.primary,
    flexShrink: 0,
    height: "1rem",
    marginTop: "0.1rem",
    width: "1rem",
  },
  scopeName: { fontFamily: MONO, fontSize: "0.75rem", fontWeight: 600 },
  scopeText: { color: colors.mutedForeground },
  actions: { display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
  error: {
    alignItems: "flex-start",
    color: colors.destructive,
    display: "flex",
    fontSize: "0.875rem",
    gap: "0.5rem",
    lineHeight: 1.5,
    margin: 0,
  },
});

/** The card every OAuth page sits in: the plug mark, an eyebrow and a title. */
export function OAuthCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.wrap)}>
      <div {...stylex.props(styles.card)}>
        <span {...stylex.props(styles.mark)}>
          <PlugsConnected size={22} weight="bold" />
        </span>
        <div>
          <p {...stylex.props(styles.eyebrow)}>Connect an app</p>
          {title && <h1 {...stylex.props(styles.title)}>{title}</h1>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function OAuthError({ message }: { message: string }) {
  return (
    <p {...stylex.props(styles.error)}>
      <WarningCircle size={18} /> {message}
    </p>
  );
}

/** Where Better Auth's endpoints send the browser next ({ redirect, url }). */
export function follow(result: {
  data?: unknown;
  error?: { message?: string; error_description?: string } | null;
}) {
  if (result.error)
    throw new Error(result.error.error_description ?? result.error.message ?? "Could not continue");
  const url = (result.data as { url?: string } | null)?.url;
  if (url) window.location.href = url;
}
