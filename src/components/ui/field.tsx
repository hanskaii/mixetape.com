import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors } from "./tokens.stylex";

const styles = stylex.create({
  field: { alignContent: "start", display: "grid", gap: "0.375rem" },
  head: {
    alignItems: "baseline",
    color: colors.foreground,
    display: "flex",
    fontSize: "0.8125rem",
    fontWeight: 500,
    gap: "0.5rem",
    justifyContent: "space-between",
  },
  counter: {
    color: colors.mutedForeground,
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.6875rem",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
  },
  counterOver: { color: colors.destructive },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", lineHeight: 1.45, margin: 0 },
});

/** A labelled form control, with an optional hint under it and a length counter beside it. */
export function Field({
  label,
  hint,
  length,
  maxLength,
  children,
  style,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** The value's length, shown against maxLength. */
  length?: number;
  maxLength?: number;
  children: ReactNode;
  style?: StyleXStyles;
}) {
  return (
    <label {...stylex.props(styles.field, style)}>
      <span {...stylex.props(styles.head)}>
        {label}
        {maxLength !== undefined && length !== undefined && (
          <span {...stylex.props(styles.counter, length > maxLength && styles.counterOver)}>
            {length}/{maxLength}
          </span>
        )}
      </span>
      {children}
      {hint && <span {...stylex.props(styles.hint)}>{hint}</span>}
    </label>
  );
}
