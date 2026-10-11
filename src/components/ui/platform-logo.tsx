import * as stylex from "@stylexjs/stylex";
import { PLATFORM_MARKS } from "./platform-marks";

const styles = stylex.create({
  logo: { flexShrink: 0, height: "1em", width: "1em" },
  xs: { fontSize: "0.8125rem" },
  sm: { fontSize: "1.125rem" },
  md: { fontSize: "1.5rem" },
  lg: { fontSize: "2rem" },
});

/**
 * A platform's mark: one family for every platform, in the colour of the text around it, so
 * a row of them reads as a set. Beside its name, or standing in for a channel with no picture.
 */
export function PlatformMark({ provider, className }: { provider: string; className?: string }) {
  const mark = PLATFORM_MARKS[provider] ?? PLATFORM_MARKS.youtube;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={className}>
      <path fill="currentColor" fillRule={mark.evenodd ? "evenodd" : undefined} d={mark.d} />
    </svg>
  );
}

/** A platform's mark at a size of the workspace's scale. */
export function PlatformLogo({
  provider,
  size = "lg",
}: {
  provider: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const mark = PLATFORM_MARKS[provider] ?? PLATFORM_MARKS.youtube;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stylex.props(styles.logo, styles[size])}>
      <path fill="currentColor" fillRule={mark.evenodd ? "evenodd" : undefined} d={mark.d} />
    </svg>
  );
}
