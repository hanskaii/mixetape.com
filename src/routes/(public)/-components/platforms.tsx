import * as stylex from "@stylexjs/stylex";
import { XLogo } from "@phosphor-icons/react";
import { colors } from "../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// The roadmap, in the order they are planned. Only YouTube publishes today; everything
// else is labelled as coming, never shown as a live destination (PRODUCT.md, DESIGN.md).
// Logos live in public/icons/platforms (X uses the Phosphor mark).
const COMING: { name: string; logo: string | null }[] = [
  { name: "X", logo: null },
  { name: "Instagram", logo: "instagram" },
  { name: "LinkedIn", logo: "linkedin" },
  { name: "Facebook", logo: "facebook" },
  { name: "TikTok", logo: "tiktok" },
  { name: "Bluesky", logo: "bluesky" },
  { name: "Threads", logo: "threads" },
  { name: "Pinterest", logo: "pinterest" },
  { name: "Google Business", logo: "google-business" },
];

const styles = stylex.create({
  section: {
    alignItems: { default: "flex-start", "@media (min-width: 1024px)": "center" },
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: { default: "column", "@media (min-width: 1024px)": "row" },
    gap: "1.25rem",
    marginBlockStart: "2.5rem",
    paddingBlock: "1.75rem",
  },
  heading: {
    color: colors.mutedForeground,
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    marginBlock: 0,
    textTransform: "uppercase",
    width: { default: "auto", "@media (min-width: 1024px)": "9rem" },
  },
  list: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "12px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.mutedForeground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 500,
    gap: "0.5rem",
    paddingBlock: "0.45rem",
    paddingInline: "0.75rem",
  },
  live: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
    color: colors.background,
    fontWeight: 600,
  },
  // A small white tile, so every logo (including the black ones) reads in both themes.
  tile: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.06)",
    display: "inline-flex",
    flexShrink: 0,
    height: "1.5rem",
    justifyContent: "center",
    width: "1.5rem",
  },
  logo: { display: "block", height: "1rem", objectFit: "contain", width: "1rem" },
  xMark: { color: "#000000", height: "0.95rem", width: "0.95rem" },
  tag: {
    borderRadius: "6px",
    fontFamily: MONO,
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    paddingBlock: "0.15rem",
    paddingInline: "0.35rem",
    textTransform: "uppercase",
  },
  tagLive: { backgroundColor: colors.primary, color: colors.primaryForeground },
  tagSoon: { backgroundColor: colors.muted, color: colors.mutedForeground },
});

export function Platforms() {
  return (
    <section {...stylex.props(styles.section)} aria-labelledby="platforms-heading">
      <h2 id="platforms-heading" {...stylex.props(styles.heading)}>
        Publishes to
      </h2>
      <ul {...stylex.props(styles.list)}>
        <li {...stylex.props(styles.chip, styles.live)}>
          <span {...stylex.props(styles.tile)}>
            <img src="/icons/platforms/youtube.svg" alt="" {...stylex.props(styles.logo)} />
          </span>
          YouTube
          <span {...stylex.props(styles.tag, styles.tagLive)}>Live</span>
        </li>
        {COMING.map(({ name, logo }) => (
          <li key={name} {...stylex.props(styles.chip)}>
            <span {...stylex.props(styles.tile)}>
              {logo ? (
                <img src={`/icons/platforms/${logo}.svg`} alt="" {...stylex.props(styles.logo)} />
              ) : (
                <XLogo {...stylex.props(styles.xMark)} weight="bold" />
              )}
            </span>
            {name}
            <span {...stylex.props(styles.tag, styles.tagSoon)}>Soon</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
