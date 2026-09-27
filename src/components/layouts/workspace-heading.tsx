import * as stylex from "@stylexjs/stylex";
import { colors } from "../ui/tokens.stylex";

const styles = stylex.create({
  root: {
    display: "grid",
    gap: "0.35rem",
    paddingBlockEnd: "0.5rem",
  },
  section: {
    color: colors.mutedForeground,
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontFamily: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    fontSize: { "@media (min-width: 640px)": "2.75rem", default: "2.2rem" },
    fontWeight: 600,
    letterSpacing: "-0.055em",
    lineHeight: 1.06,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    maxWidth: "40rem",
  },
});

export function WorkspaceHeading({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description: string;
}) {
  return (
    <div {...stylex.props(styles.root)} aria-label={section}>
      <h1 {...stylex.props(styles.title)}>{title}</h1>
      <p {...stylex.props(styles.description)}>{description}</p>
    </div>
  );
}
