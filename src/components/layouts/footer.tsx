import dayjs from "dayjs";
import * as stylex from "@stylexjs/stylex";
import { siteConfig } from "#/config/site";
import { colors } from "../ui/tokens.stylex";
import { Rule } from "./rule";

const styles = stylex.create({
  footer: {
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    paddingBlock: "2rem",
    paddingInline: "1rem",
    position: "relative",
  },
  row: {
    alignItems: { default: "flex-start", "@media (min-width: 640px)": "flex-end" },
    display: "flex",
    flexDirection: { default: "column", "@media (min-width: 640px)": "row" },
    gap: "0.5rem",
    justifyContent: "space-between",
  },
  name: {
    color: colors.foreground,
    fontSize: "0.875rem",
    fontWeight: 600,
    letterSpacing: "-0.025em",
    margin: 0,
  },
  tagline: { marginBlockEnd: 0, marginBlockStart: "0.25rem" },
  legal: {
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "11px",
    letterSpacing: "0.025em",
    margin: 0,
  },
});

export default function Footer() {
  const year = dayjs().format("YYYY");

  return (
    <footer {...stylex.props(styles.footer)}>
      <Rule position="top" />
      <div {...stylex.props(styles.row)}>
        <div>
          <p {...stylex.props(styles.name)}>{siteConfig.name}</p>
          <p {...stylex.props(styles.tagline)}>Social scheduling for AI agents.</p>
        </div>
        <p {...stylex.props(styles.legal)}>
          &copy; {year} {siteConfig.name} · <a href="/pricing">Pricing</a> ·{" "}
          <a href={siteConfig.docsUrl}>Docs</a> · <a href="/privacy">Privacy</a> ·{" "}
          <a href="/terms">Terms</a>
        </p>
      </div>
    </footer>
  );
}
