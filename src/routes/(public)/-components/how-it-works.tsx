import * as stylex from "@stylexjs/stylex";
import { colors } from "../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const STEPS = [
  {
    title: "Connect your channels",
    text: "Through your own OAuth app, so the platform quota and approval stay yours. A new tab opens, you allow access, and the channel appears.",
  },
  {
    title: "Give your agent a key",
    text: "Add mixetape as an MCP server, or call the REST API from any script. The agent sees the same channels and queue you do.",
  },
  {
    title: "mixetape holds the post",
    text: "Each post waits in mixetape — editable, movable, cancellable — and goes up shortly before its time, so the platform has finished processing when it goes live.",
  },
  {
    title: "Everyone sees what happened",
    text: "Scheduled, uploaded, published or failed, with the reason when something goes wrong. Retry or cancel from the workspace or the API.",
  },
];

const styles = stylex.create({
  section: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "grid",
    gap: "2.25rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "0.8fr 1.2fr" },
    marginBlockStart: "1rem",
    paddingBlock: "5rem",
    scrollMarginTop: "6rem",
  },
  kicker: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.75rem",
    letterSpacing: "0.16em",
    marginBlock: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(2.7rem, 5vw, 4.7rem)",
    fontWeight: 600,
    letterSpacing: "-0.065em",
    lineHeight: 0.99,
    marginBlockEnd: 0,
    marginBlockStart: "1rem",
  },
  serif: {
    color: colors.editorial,
    fontFamily: "var(--font-editorial)",
    fontWeight: 400,
    letterSpacing: "-0.025em",
  },
  list: {
    borderBlockColor: colors.border,
    borderBlockStyle: "solid",
    borderBlockWidth: "1px",
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  step: {
    borderBlockStartColor: { default: colors.border, ":first-child": "transparent" },
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    columnGap: "0.75rem",
    display: "grid",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 640px)": "36px 1fr" },
    paddingBlock: "1.5rem",
    rowGap: "0.75rem",
  },
  number: { color: colors.mutedForeground, fontFamily: MONO, fontSize: "0.75rem" },
  stepTitle: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginBlock: 0 },
  stepText: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "0.25rem",
    maxWidth: "36rem",
  },
});

export function HowItWorks() {
  return (
    <section id="how" {...stylex.props(styles.section)}>
      <div>
        <p {...stylex.props(styles.kicker)}>How it works</p>
        <h2 {...stylex.props(styles.title)}>
          One queue.
          <br />
          <em {...stylex.props(styles.serif)}>Two ways in.</em>
        </h2>
      </div>
      <ol {...stylex.props(styles.list)}>
        {STEPS.map((step, index) => (
          <li key={step.title} {...stylex.props(styles.step)}>
            <span {...stylex.props(styles.number)}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3 {...stylex.props(styles.stepTitle)}>{step.title}</h3>
              <p {...stylex.props(styles.stepText)}>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
