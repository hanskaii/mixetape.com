import * as stylex from "@stylexjs/stylex";
import { colors } from "../ui/tokens.stylex";

const styles = stylex.create({
  rule: {
    backgroundColor: colors.border,
    height: "1px",
    // Runs the full viewport width, past the page's side borders (body clips the overflow).
    left: "50%",
    pointerEvents: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    width: "100vw",
  },
  top: { top: "-1px" },
  bottom: { bottom: "-1px" },
});

/** A full-bleed hairline on the top or bottom edge of a positioned element. */
export function Rule({ position }: { position: "top" | "bottom" }) {
  return <div aria-hidden="true" {...stylex.props(styles.rule, styles[position])} />;
}
