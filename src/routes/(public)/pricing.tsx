import { createFileRoute } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { Check } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import { Button } from "#/components/ui/button";
import { colors } from "../../components/ui/tokens.stylex";
import { publicHead } from "./-lib/head";

export const Route = createFileRoute("/(public)/pricing")({
  head: () =>
    publicHead({
      path: "/pricing",
      title: `Pricing | ${siteConfig.name}`,
      description:
        "mixetape plans: Free, Creator at $9 and Studio at $29 a month, for agents that schedule posts to six platforms over MCP and REST. Plans launch soon.",
    }),
  component: PricingPage,
});

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// The plans as they will launch. Every feature listed works today; the limits are what
// each plan will allow. Until checkout opens, every button says Soon.
const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    pitch: "Try it with an agent and a couple of channels.",
    features: [
      "2 channels",
      "30 scheduled posts a month",
      "1 API key",
      "MCP server and REST API",
      "All six platforms",
    ],
    featured: false,
  },
  {
    name: "Creator",
    price: "$9",
    period: "a month",
    pitch: "For a creator whose agents publish every day.",
    features: [
      "10 channels",
      "Unlimited scheduled posts",
      "Unlimited API keys",
      "Library groups and up to 5 brands",
      "Comments, captions and analytics",
    ],
    featured: true,
  },
  {
    name: "Studio",
    price: "$29",
    period: "a month",
    pitch: "For studios running many channels and pipelines.",
    features: [
      "50 channels",
      "Everything in Creator",
      "Unlimited brands, one per client",
      "Priority email support",
    ],
    featured: false,
  },
];

const INCLUDED = [
  {
    title: "Six platforms",
    text: "YouTube, TikTok, Instagram, Facebook Pages, Threads and Pinterest, each connected with a sign-in.",
  },
  {
    title: "MCP and REST API",
    text: "Every action in the workspace, for your agents and scripts, with keys that decide what each one may do.",
  },
  {
    title: "A queue you can see",
    text: "Each post stays editable, movable and cancellable until it goes out, and reports back when it does.",
  },
  {
    title: "Library and storage",
    text: "Upload or import media, group it with its words, and publish it to several channels at once.",
  },
];

const LG = "@media (min-width: 1024px)";

const styles = stylex.create({
  hero: {
    paddingBlockEnd: "1.5rem",
    paddingBlockStart: { default: "3rem", [LG]: "4rem" },
    paddingInlineStart: { default: 0, [LG]: "4rem" },
  },
  eyebrow: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    marginBlock: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.foreground,
    fontSize: "clamp(3.25rem, 7vw, 6rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 0.94,
    marginBlockEnd: 0,
    marginBlockStart: "1rem",
  },
  serif: {
    color: colors.editorial,
    fontFamily: "var(--font-editorial)",
    fontSize: "1.04em",
    fontWeight: 400,
    letterSpacing: "-0.045em",
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: { default: "1.125rem", "@media (min-width: 640px)": "1.25rem" },
    lineHeight: 1.45,
    marginBlockEnd: 0,
    marginBlockStart: "1.5rem",
    maxWidth: "640px",
  },
  plans: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: { default: "1fr", [LG]: "repeat(3, 1fr)" },
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  plan: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    padding: "1.5rem",
  },
  featured: {
    borderColor: "#ebc62c",
    boxShadow: "0 18px 48px -40px rgba(35, 25, 8, 0.35)",
  },
  planHead: {
    alignItems: "center",
    display: "flex",
    gap: "0.5rem",
    justifyContent: "space-between",
  },
  planName: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginBlock: 0 },
  tag: {
    backgroundColor: "#ffd337",
    borderRadius: "999px",
    color: "#11110f",
    fontFamily: MONO,
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    paddingBlock: "0.25rem",
    paddingInline: "0.5rem",
    textTransform: "uppercase",
  },
  price: { alignItems: "baseline", display: "flex", gap: "0.5rem", margin: 0 },
  amount: { fontSize: "3rem", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 },
  period: { color: colors.mutedForeground, fontSize: "0.875rem" },
  pitch: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: 1.6,
    marginBlock: 0,
  },
  features: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "0.625rem",
    listStyle: "none",
    marginBlock: 0,
    paddingBlockStart: "1.25rem",
    paddingInline: 0,
  },
  feature: { alignItems: "flex-start", display: "flex", fontSize: "0.875rem", gap: "0.5rem" },
  check: { color: colors.editorial, flexShrink: 0, marginBlockStart: "0.2rem" },
  soon: { width: "100%" },
  note: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    marginBlockEnd: 0,
    marginBlockStart: "0.75rem",
    marginInlineStart: "0.5rem",
  },
  section: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "grid",
    gap: "2.25rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "0.8fr 1.2fr" },
    marginBlockStart: "1rem",
    paddingBlock: "5rem",
  },
  sectionTitle: {
    fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    marginBlock: 0,
  },
  list: {
    borderBlockColor: colors.border,
    borderBlockStyle: "solid",
    borderBlockWidth: "1px",
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  item: {
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
  itemTitle: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginBlock: 0 },
  itemText: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "0.25rem",
    maxWidth: "36rem",
  },
  mail: { color: colors.foreground, textDecoration: "underline", textUnderlineOffset: "4px" },
});

function PricingPage() {
  return (
    <>
      <section {...stylex.props(styles.hero)}>
        <p {...stylex.props(styles.eyebrow)}>Pricing</p>
        <h1 {...stylex.props(styles.title)}>
          Simple plans, <em {...stylex.props(styles.serif)}>coming soon.</em>
        </h1>
        <p {...stylex.props(styles.lede)}>
          Pay for the channels your agents publish to, not for seats. Checkout opens soon; until
          then, mixetape is free to use as it is today.
        </p>
      </section>

      <div>
        <ul {...stylex.props(styles.plans)}>
          {PLANS.map((plan) => (
            <li key={plan.name} {...stylex.props(styles.plan, plan.featured && styles.featured)}>
              <div {...stylex.props(styles.planHead)}>
                <h2 {...stylex.props(styles.planName)}>{plan.name}</h2>
                {plan.featured && <span {...stylex.props(styles.tag)}>Popular</span>}
              </div>
              <p {...stylex.props(styles.price)}>
                <span {...stylex.props(styles.amount)}>{plan.price}</span>
                <span {...stylex.props(styles.period)}>{plan.period}</span>
              </p>
              <p {...stylex.props(styles.pitch)}>{plan.pitch}</p>
              <ul {...stylex.props(styles.features)}>
                {plan.features.map((feature) => (
                  <li key={feature} {...stylex.props(styles.feature)}>
                    <Check size={16} weight="bold" aria-hidden {...stylex.props(styles.check)} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                variant={plan.featured ? "default" : "outline"}
                disabled
                style={styles.soon}
              >
                Soon
              </Button>
            </li>
          ))}
        </ul>
        <p {...stylex.props(styles.note)}>
          Prices in USD. Plans and limits may change before checkout opens. Questions:{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} {...stylex.props(styles.mail)}>
            {siteConfig.contactEmail}
          </a>
        </p>
      </div>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>Every plan includes</h2>
        <ol {...stylex.props(styles.list)}>
          {INCLUDED.map((item, index) => (
            <li key={item.title} {...stylex.props(styles.item)}>
              <span {...stylex.props(styles.number)}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 {...stylex.props(styles.itemTitle)}>{item.title}</h3>
                <p {...stylex.props(styles.itemText)}>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
