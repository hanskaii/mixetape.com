import * as stylex from "@stylexjs/stylex";
import { colors } from "./tokens.stylex";
import { PLATFORM_MARKS } from "./platform-marks";

const styles = stylex.create({
  logo: { flexShrink: 0, height: "1em", width: "1em" },
  xs: { fontSize: "0.8125rem" },
  sm: { fontSize: "1.125rem" },
  md: { fontSize: "1.5rem" },
  lg: { fontSize: "2rem" },
  // Each platform's own colour; the two black marks follow the text.
  youtube: { color: "#ef4444" },
  facebook: { color: "#1877f2" },
  instagram: { color: "#d62976" },
  pinterest: { color: "#e60023" },
  bluesky: { color: "#1185fe" },
  mastodon: { color: "#6364ff" },
  ink: { color: colors.foreground },
});

const TINT: Record<string, stylex.StyleXStyles> = {
  youtube: styles.youtube,
  facebook: styles.facebook,
  instagram: styles.instagram,
  pinterest: styles.pinterest,
  bluesky: styles.bluesky,
  mastodon: styles.mastodon,
  threads: styles.ink,
  tiktok: styles.ink,
};

/**
 * A platform's mark in the colour of the text around it: for a tile that sets its own colour
 * (the landing's white marks on brand colours).
 */
export function PlatformMark({ provider, className }: { provider: string; className?: string }) {
  const mark = PLATFORM_MARKS[provider] ?? PLATFORM_MARKS.youtube;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={className}>
      <path fill="currentColor" fillRule={mark.evenodd ? "evenodd" : undefined} d={mark.d} />
    </svg>
  );
}

/** A platform's mark at a size of the workspace's scale, in the platform's own colour. */
export function PlatformLogo({
  provider,
  size = "lg",
}: {
  provider: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const mark = PLATFORM_MARKS[provider] ?? PLATFORM_MARKS.youtube;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...stylex.props(styles.logo, styles[size], TINT[provider] ?? styles.youtube)}
    >
      <path fill="currentColor" fillRule={mark.evenodd ? "evenodd" : undefined} d={mark.d} />
    </svg>
  );
}
