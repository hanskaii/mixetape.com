import * as stylex from "@stylexjs/stylex";
import { colors } from "../../../components/ui/tokens.stylex";
import { Plans } from "./plans";

const styles = stylex.create({
  section: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "2.25rem",
    paddingBlock: "5rem",
    scrollMarginTop: "6rem",
  },
  head: {
    alignItems: "end",
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    justifyContent: "space-between",
  },
  title: {
    fontSize: "clamp(2.7rem, 5vw, 4.7rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    marginBlock: 0,
  },
  serif: {
    color: colors.editorial,
    fontFamily: "var(--font-editorial)",
    fontWeight: 400,
    letterSpacing: "-0.025em",
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: "1.0625rem",
    lineHeight: 1.6,
    margin: 0,
    maxWidth: "26rem",
  },
});

export function LandingPricing({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="pricing" {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.head)}>
        <h2 {...stylex.props(styles.title)}>
          Pay per account.
          <br />
          <em {...stylex.props(styles.serif)}>Not per seat.</em>
        </h2>
        <p {...stylex.props(styles.lede)}>
          Every plan starts with a 7-day free trial, with all eight platforms, MCP and the REST API.
        </p>
      </div>
      <Plans signedIn={signedIn} />
    </section>
  );
}
