import { createFileRoute } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { siteConfig } from "#/config/site";
import { Route as RootRoute } from "#/routes/__root";
import { colors } from "../../components/ui/tokens.stylex";
import { publicHead } from "./-lib/head";
import { Plans } from "#/components/marketing/plans";

export const Route = createFileRoute("/(public)/pricing")({
  head: () =>
    publicHead({
      path: "/pricing",
      title: `Pricing | ${siteConfig.name}`,
      description:
        "mixetape plans: Creator at $39 a month for 15 accounts, Studio from $100 a month for 100 accounts and $1 each after. 7-day free trial, eight platforms, MCP and REST.",
    }),
  component: PricingPage,
});

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const INCLUDED = [
  {
    title: "Eight platforms",
    text: "YouTube, TikTok, Instagram, Facebook Pages, Threads, Pinterest, Bluesky and Mastodon, each connected with a sign-in.",
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
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  return (
    <>
      <section {...stylex.props(styles.hero)}>
        <p {...stylex.props(styles.eyebrow)}>Pricing</p>
        <h1 {...stylex.props(styles.title)}>
          Pay per account, <em {...stylex.props(styles.serif)}>not per seat.</em>
        </h1>
        <p {...stylex.props(styles.lede)}>
          Every plan starts with a 7-day free trial. Pick how many social accounts your agents
          publish to; everything else is included.
        </p>
      </section>

      <div>
        <Plans signedIn={signedIn} />
        <p {...stylex.props(styles.note)}>
          Prices in USD. Questions:{" "}
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
