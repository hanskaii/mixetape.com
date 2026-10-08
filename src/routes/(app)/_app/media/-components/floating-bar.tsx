import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";

const rise = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(0.5rem)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  dock: {
    bottom: "1rem",
    display: "flex",
    insetInline: 0,
    justifyContent: "center",
    paddingInline: "1rem",
    pointerEvents: "none",
    position: "fixed",
    zIndex: 40,
    // Centred on the content, clear of the sidebar.
    left: { default: 0, "@media (min-width: 768px)": "15rem" },
  },
  bar: {
    alignItems: "center",
    animationDuration: "200ms",
    animationName: rise,
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 18px 40px -12px rgb(0 0 0 / 0.35)",
    display: "flex",
    gap: "0.375rem",
    maxWidth: "100%",
    overflowX: "auto",
    padding: "0.375rem",
    pointerEvents: "auto",
    scrollbarWidth: "none",
  },
});

/** A bar floating at the bottom of the content: the selection's actions, drop targets. */
export function FloatingBar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div {...stylex.props(styles.dock)}>
      <div role="toolbar" aria-label={label} {...stylex.props(styles.bar)}>
        {children}
      </div>
    </div>
  );
}
