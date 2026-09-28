import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { colors, radius } from "./tokens.stylex";

const styles = stylex.create({
  root: {
    appearance: "none",
    backgroundColor: colors.card,
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 1rem) 55%, calc(100% - 0.7rem) 55%",
    backgroundRepeat: "no-repeat",
    backgroundSize: "0.3rem 0.3rem",
    borderColor: { default: colors.input, ":focus-visible": colors.ring },
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    cursor: "pointer",
    fontSize: "0.8125rem",
    height: "2.25rem",
    outline: "none",
    paddingInline: "0.75rem 2rem",
    width: "100%",
  },
});

export type SelectProps = Omit<React.ComponentProps<"select">, "style" | "className"> & {
  style?: StyleXStyles;
};

/** The platform's own select, styled like the other fields — right for short fixed lists. */
export function Select({ style, ...props }: SelectProps) {
  return <select {...stylex.props(styles.root, style)} {...props} />;
}
