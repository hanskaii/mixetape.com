import { createFileRoute } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { colors } from "../../components/ui/tokens.stylex";
import { LandingCta } from "./-components/landing-cta";
import { publicHead } from "./-lib/head";

export const Route = createFileRoute("/(public)/pricing")({
  head: () =>
    publicHead({
      path: "/pricing",
      title: `Pricing | ${siteConfig.name}`,
      description:
        "mixetape has no paid plans yet. Sign in, connect your channels and let your agents schedule posts through MCP or the REST API today.",
    }),
  component: PricingPage,
});

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// Only what the product does today (DESIGN.md: no claims or prices it cannot back).
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

const styles = stylex.create({
  hero: {
    paddingBlockEnd: "1.5rem",
    paddingBlockStart: { default: "3rem", "@media (min-width: 1024px)": "4rem" },
    paddingInlineStart: { default: 0, "@media (min-width: 1024px)": "4rem" },
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
});

function PricingPage() {
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  return (
    <>
      <section {...stylex.props(styles.hero)}>
        <p {...stylex.props(styles.eyebrow)}>Pricing</p>
        <h1 {...stylex.props(styles.title)}>
          Plans are <em {...stylex.props(styles.serif)}>coming soon.</em>
        </h1>
        <p {...stylex.props(styles.lede)}>
          There is no paid plan yet. Sign in, connect your channels and give your agent a key —
          mixetape works today as it is described in the docs.
        </p>
        <div {...stylex.props(styles.actions)}>
          <LandingCta
            signedIn={signedIn}
            to="/api-keys"
            signedInLabel="Get an API key"
            signedOutLabel="Get an API key"
          />
          <a href={`mailto:${siteConfig.contactEmail}`} {...stylex.props(styles.secondary)}>
            Ask about pricing
          </a>
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>What you get today</h2>
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
