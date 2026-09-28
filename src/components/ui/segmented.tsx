import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "./tokens.stylex";

const styles = stylex.create({
  track: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    display: "inline-flex",
    flexShrink: 0,
    gap: "0.125rem",
    maxWidth: "100%",
    overflowX: "auto",
    padding: "0.25rem",
    scrollbarWidth: "none",
  },
  option: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": null },
    borderRadius: radius.md,
    borderStyle: "none",
    color: { default: colors.mutedForeground, ":hover": colors.foreground },
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontSize: "0.75rem",
    fontWeight: 500,
    gap: "0.375rem",
    height: "1.75rem",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    paddingInline: "0.75rem",
    transitionDuration: "150ms",
    transitionProperty: "background-color, color, box-shadow",
    whiteSpace: "nowrap",
  },
  active: {
    backgroundColor: colors.card,
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)",
    color: colors.foreground,
  },
});

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

/**
 * A few mutually exclusive choices side by side — a filter, now or later, one of several
 * tabs. `role` is "radiogroup" for choices and "tablist" when each option shows a panel.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  role = "radiogroup",
  style,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  role?: "radiogroup" | "tablist";
  style?: StyleXStyles;
}) {
  return (
    <div role={role} aria-label={label} {...stylex.props(styles.track, style)}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={role === "tablist" ? "tab" : "radio"}
            aria-checked={role === "radiogroup" ? on : undefined}
            aria-selected={role === "tablist" ? on : undefined}
            onClick={() => onChange(option.value)}
            {...stylex.props(styles.option, on && styles.active)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
