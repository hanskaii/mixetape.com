import { CircleNotch } from "@phosphor-icons/react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { customClassName } from "./stylex-utils";

const turn = stylex.keyframes({ to: { transform: "rotate(360deg)" } });

const styles = stylex.create({
  spin: {
    animationDuration: "700ms",
    animationIterationCount: "infinite",
    animationName: turn,
    animationTimingFunction: "linear",
    flexShrink: 0,
  },
});

/**
 * The one loading indicator: a bold arc that turns smoothly at any size. Size it like an
 * icon (size, or the className a Button sets on its svg); it is hidden from screen readers —
 * say what is happening in text or aria-busy next to it.
 */
export function Spinner({
  size,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: StyleXStyles;
}) {
  return (
    <CircleNotch
      size={size}
      weight="bold"
      aria-hidden
      {...stylex.props(styles.spin, customClassName(className), style)}
    />
  );
}
