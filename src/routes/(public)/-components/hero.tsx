import * as stylex from "@stylexjs/stylex";
import { ArrowDown, CheckCircle, Hourglass, Robot } from "@phosphor-icons/react";
import { colors } from "../../../components/ui/tokens.stylex";
import { LandingCta } from "./landing-cta";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

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
  visual: {
    backgroundImage: "linear-gradient(135deg, #ffe974 0%, #ffab3e 48%, #e9582d 100%)",
    borderRadius: "20px",
    color: "#11110f",
    minWidth: 0,
    overflow: "hidden",
    paddingBlock: { default: "1.5rem", "@media (min-width: 640px)": "2rem" },
    paddingInline: {
      default: "1.25rem",
      "@media (min-width: 640px)": "2rem",
      "@media (min-width: 1024px)": "2.5rem",
    },
  },
  label: {
    color: "#3b2a12",
    fontSize: "0.8125rem",
    fontWeight: 600,
    margin: 0,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#fffefa",
    borderRadius: "18px",
    boxShadow: "0 12px 24px -20px rgba(58, 28, 0, 0.35)",
    display: "flex",
    gap: "0.75rem",
    marginBlockStart: "1rem",
    padding: { default: "1rem", "@media (min-width: 640px)": "1.25rem" },
  },
  codeCard: { alignItems: "stretch", flexDirection: "column" },
  row: { alignItems: "center", display: "flex", gap: "0.75rem" },
  tile: {
    backgroundColor: "#f1eee7",
    borderRadius: "10px",
    display: "grid",
    flexShrink: 0,
    height: "2.5rem",
    placeItems: "center",
    width: "2.5rem",
  },
  tileWarm: { backgroundColor: "#fff0eb" },
  tileIcon: { height: "1.35rem", width: "1.35rem" },
  cardTitle: {
    flexGrow: 1,
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  cardMeta: { color: "#77736c", fontSize: "0.75rem" },
  code: {
    backgroundColor: "#f5f2eb",
    borderRadius: "12px",
    color: "#37342f",
    fontFamily: MONO,
    fontSize: { default: "0.7rem", "@media (min-width: 640px)": "0.75rem" },
    lineHeight: 1.55,
    margin: 0,
    overflowX: "auto",
    paddingBlock: "0.75rem",
    paddingInline: "1rem",
    whiteSpace: "pre",
  },
  arrow: {
    display: "block",
    height: "1.5rem",
    marginBlock: "0.75rem",
    marginInline: "auto",
    width: "1.5rem",
  },
  cardBody: { flexGrow: 1, minWidth: 0 },
  strong: { fontWeight: 600, margin: 0 },
  muted: { color: "#57534d", fontSize: "0.875rem", margin: 0 },
  pill: {
    alignItems: "center",
    backgroundColor: "#e9f2e1",
    borderRadius: "8px",
    color: "#284b27",
    display: "inline-flex",
    fontSize: "0.75rem",
    fontWeight: 600,
    gap: "0.35rem",
    paddingBlock: "0.35rem",
    paddingInline: "0.6rem",
    whiteSpace: "nowrap",
  },
  pillHold: { backgroundColor: "#fff3c4", color: "#6b4e00" },
});

const CALL = `create_post({
  accountId: "yt-hans-explainer",
  mediaUrl: "https://…/episode-12.mp4",
  scheduledAt: "2026-10-02T17:30:00+07:00",
  metadata: { title: "You Are Not Broken At 3 A.M." }
})`;

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
          mixetape is an agent-first social scheduler. Claude Code, your own agent or a pipeline
          schedules posts through MCP (the protocol agents already speak) or a REST API; mixetape
          holds each post, publishes it on time and tells the agent what went live.
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

      <div {...stylex.props(styles.visual)} aria-label="Illustrative example">
        <p {...stylex.props(styles.label)}>An illustrative example</p>

        <div {...stylex.props(styles.card, styles.codeCard)}>
          <div {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.tile)}>
              <Robot {...stylex.props(styles.tileIcon)} weight="bold" />
            </span>
            <p {...stylex.props(styles.cardTitle)}>Your agent schedules a post</p>
            <span {...stylex.props(styles.cardMeta)}>MCP · API</span>
          </div>
          <pre {...stylex.props(styles.code)}>
            <code>{CALL}</code>
          </pre>
        </div>

        <ArrowDown {...stylex.props(styles.arrow)} weight="bold" aria-hidden="true" />

        <div {...stylex.props(styles.card)}>
          <span {...stylex.props(styles.tile)}>
            <Hourglass {...stylex.props(styles.tileIcon)} weight="bold" />
          </span>
          <div {...stylex.props(styles.cardBody)}>
            <p {...stylex.props(styles.strong)}>Held in mixetape</p>
            <p {...stylex.props(styles.muted)}>Editable and cancellable until it goes out</p>
          </div>
          <span {...stylex.props(styles.pill, styles.pillHold)}>Scheduled</span>
        </div>

        <ArrowDown {...stylex.props(styles.arrow)} weight="bold" aria-hidden="true" />

        <div {...stylex.props(styles.card)}>
          <span {...stylex.props(styles.tile, styles.tileWarm)}>
            <img src="/icons/platforms/youtube.svg" alt="" {...stylex.props(styles.tileIcon)} />
          </span>
          <div {...stylex.props(styles.cardBody)}>
            <p {...stylex.props(styles.strong)}>Friday 17:30</p>
            <p {...stylex.props(styles.muted)}>YouTube · live on time</p>
          </div>
          <span {...stylex.props(styles.pill)}>
            <CheckCircle weight="bold" /> Published
          </span>
        </div>
      </div>
    </section>
  );
}
