import * as stylex from "@stylexjs/stylex";
import { colors } from "../../../components/ui/tokens.stylex";
import { HeroDemo } from "./hero-demo";
import { LandingCta } from "./landing-cta";

const styles = stylex.create({
  section: {
    alignItems: "center",
    columnGap: { default: "2.5rem", "@media (min-width: 1024px)": "3.5rem" },
    display: "grid",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 1024px)": "1.08fr 1fr" },
    paddingBlockEnd: "1.5rem",
    paddingBlockStart: { default: "3rem", "@media (min-width: 1024px)": "2.5rem" },
    rowGap: "2.5rem",
  },
  copy: {
    minWidth: 0,
    paddingInlineStart: { default: 0, "@media (min-width: 1024px)": "4rem" },
    paddingBlockStart: { default: 0, "@media (min-width: 1024px)": "1rem" },
  },
  title: {
    color: colors.foreground,
    fontSize: "clamp(3.25rem, 7vw, 6rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 0.94,
    margin: 0,
  },
  titleSerif: {
    color: colors.editorial,
    display: "block",
    fontFamily: "var(--font-editorial)",
    fontSize: "1.04em",
    fontWeight: 400,
    letterSpacing: "-0.045em",
    lineHeight: 1,
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: {
      default: "1.125rem",
      "@media (min-width: 640px)": "1.25rem",
      "@media (min-width: 1024px)": "1.375rem",
    },
    lineHeight: 1.45,
    marginBlockStart: "1.5rem",
    maxWidth: "640px",
  },
  actions: {
    alignItems: "center",
    columnGap: "2rem",
    display: "flex",
    flexWrap: "wrap",
    marginBlockStart: "1.5rem",
    rowGap: "1rem",
  },
  secondary: {
    color: colors.foreground,
    fontSize: "1rem",
    fontWeight: 500,
    textDecoration: "underline",
    textUnderlineOffset: "7px",
  },
});

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.copy)}>
        <h1 {...stylex.props(styles.title)}>
          Your agents publish
          <br />
          <em {...stylex.props(styles.titleSerif)}>on your time.</em>
        </h1>
        <p {...stylex.props(styles.lede)}>
          Tell your agent what to publish and when. It schedules through MCP or API; mixetape
          publishes across your channels on time and reports back with the result.
        </p>
        <div {...stylex.props(styles.actions)}>
          <LandingCta
            signedIn={signedIn}
            to="/api-keys"
            signedInLabel="Get an API key"
            signedOutLabel="Get an API key"
          />
          <a href="#agents" {...stylex.props(styles.secondary)}>
            See how agents connect
          </a>
        </div>
      </div>
      <HeroDemo />
    </section>
  );
}
