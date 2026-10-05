import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Check, Minus, Plus } from "@phosphor-icons/react";
import { colors } from "../../../components/ui/tokens.stylex";
import { LandingCta } from "./landing-cta";

// Operator is priced per account: the base covers OPERATOR_MIN, each one after is $1.
const OPERATOR_MIN = 100;
const OPERATOR_STEP = 10;
// A year costs ten months: two are free.
const MONTHS_PAID_YEARLY = 10;
const MARKETER_MONTHLY = 39;

type Billing = "monthly" | "yearly";

// What a month comes to: whole dollars monthly, cents when a year is spread over twelve.
function perMonth(monthly: number, billing: Billing) {
  const value = billing === "monthly" ? monthly : (monthly * MONTHS_PAID_YEARLY) / 12;
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function billedAs(monthly: number, billing: Billing) {
  return billing === "monthly"
    ? "billed monthly"
    : `billed yearly ($${(monthly * MONTHS_PAID_YEARLY).toLocaleString("en-US")})`;
}

// Every line here works today.
const MARKETER_FEATURES = [
  "15 social accounts",
  "YouTube, TikTok, Instagram, Facebook Pages, Threads, Pinterest, Bluesky and Mastodon",
  "Unlimited scheduled posts",
  "MCP server for Claude Code, Codex, Cursor and any agent",
  "REST API with an OpenAPI spec",
  "Unlimited API keys, each with its own permissions",
  "Media library: upload or import from a link",
  "Groups: media and words together, published to many channels at once",
  "Carousels and threads",
  "YouTube thumbnails, playlists, captions, tags and first comment",
  "Read, reply to and hide comments",
  "Post and account analytics",
  "Webhooks when a post goes live or fails",
  "Edit, cancel and retry from the queue",
  "Up to 5 brands",
];

const OPERATOR_FEATURES = [
  "100 social accounts or more, priced per account",
  "Everything in Marketer",
  "Unlimited brands, one per client",
  "Priority email support",
];

const LG = "@media (min-width: 1024px)";

const styles = stylex.create({
  wrap: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  tabs: {
    alignSelf: { default: "stretch", "@media (min-width: 640px)": "flex-start" },
    backgroundColor: colors.muted,
    borderRadius: "999px",
    display: "flex",
    gap: "0.25rem",
    padding: "0.25rem",
  },
  tab: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: "999px",
    borderWidth: 0,
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "inline-flex",
    flexGrow: { default: 1, "@media (min-width: 640px)": 0 },
    fontFamily: "inherit",
    fontSize: "0.9375rem",
    fontWeight: 600,
    gap: "0.5rem",
    justifyContent: "center",
    paddingBlock: "0.5rem",
    paddingInline: "1.25rem",
  },
  tabOn: {
    backgroundColor: colors.card,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
    color: colors.foreground,
  },
  save: { color: colors.editorial, fontSize: "0.75rem", fontWeight: 600 },
  grid: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: { default: "1fr", [LG]: "repeat(2, 1fr)" },
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
    padding: { default: "1.5rem", "@media (min-width: 640px)": "2rem" },
  },
  featured: {
    borderColor: "#ebc62c",
    borderWidth: "2px",
    boxShadow: "0 18px 48px -40px rgba(35, 25, 8, 0.35)",
  },
  head: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.625rem" },
  name: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.03em", marginBlock: 0 },
  tag: {
    borderColor: "#ebc62c",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.editorial,
    fontSize: "0.75rem",
    fontWeight: 600,
    paddingBlock: "0.125rem",
    paddingInline: "0.5rem",
  },
  pitch: {
    color: colors.mutedForeground,
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    marginBlockEnd: 0,
    marginBlockStart: "-0.75rem",
  },
  priceBlock: { display: "flex", flexDirection: "column", gap: "0.375rem" },
  price: { alignItems: "baseline", display: "flex", gap: "0.5rem", margin: 0 },
  amount: {
    fontSize: "3.5rem",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    lineHeight: 1,
  },
  period: { color: colors.mutedForeground, fontSize: "1rem" },
  billing: { color: colors.mutedForeground, fontSize: "0.875rem", margin: 0 },
  stepper: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: "14px",
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    gap: "1rem",
    justifyContent: "space-between",
    paddingBlock: "0.75rem",
    paddingInline: "1rem",
  },
  stepperLabel: { fontSize: "0.9375rem", fontWeight: 600, margin: 0 },
  stepperHint: { color: colors.mutedForeground, fontSize: "0.75rem", margin: 0 },
  control: {
    alignItems: "stretch",
    borderColor: colors.border,
    borderRadius: "10px",
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    overflow: "hidden",
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderWidth: 0,
    color: colors.foreground,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "flex",
    justifyContent: "center",
    opacity: { default: 1, ":disabled": 0.4 },
    width: "2.25rem",
  },
  count: {
    backgroundColor: "transparent",
    borderBlockWidth: 0,
    borderInlineColor: colors.border,
    borderInlineStyle: "solid",
    borderInlineWidth: "1px",
    color: colors.foreground,
    fontFamily: "inherit",
    fontSize: "0.9375rem",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    paddingBlock: "0.5rem",
    textAlign: "center",
    width: "4.5rem",
  },
  action: { display: "grid", gap: "0.625rem" },
  due: { color: colors.mutedForeground, fontSize: "0.8125rem", margin: 0, textAlign: "center" },
  features: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
    listStyle: "none",
    marginBlock: 0,
    paddingBlockStart: "1.25rem",
    paddingInline: 0,
  },
  feature: { alignItems: "flex-start", display: "flex", fontSize: "0.875rem", gap: "0.5rem" },
  check: { color: colors.editorial, flexShrink: 0, marginBlockStart: "0.2rem" },
});

const toAccounts = (value: string) =>
  Math.max(OPERATOR_MIN, Math.round(Number(value)) || OPERATOR_MIN);

function Features({ items }: { items: string[] }) {
  return (
    <ul {...stylex.props(styles.features)}>
      {items.map((item) => (
        <li key={item} {...stylex.props(styles.feature)}>
          <Check size={16} weight="bold" aria-hidden {...stylex.props(styles.check)} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Trial({ signedIn }: { signedIn: boolean }) {
  return (
    <div {...stylex.props(styles.action)}>
      <LandingCta
        signedIn={signedIn}
        signedInLabel="Open the workspace"
        signedOutLabel="Start 7 day free trial"
      />
      <p {...stylex.props(styles.due)}>$0.00 due today, cancel anytime</p>
    </div>
  );
}

/** The two plans, shown on the pricing page and the landing page. */
export function Plans({ signedIn }: { signedIn: boolean }) {
  // What is typed stays as typed until the field loses focus; the price never drops below
  // the minimum meanwhile.
  const [draft, setDraft] = useState(String(OPERATOR_MIN));
  const accounts = toAccounts(draft);
  const step = (by: number) =>
    setDraft((prev) => String(Math.max(OPERATOR_MIN, toAccounts(prev) + by)));
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div {...stylex.props(styles.wrap)}>
      <div role="group" aria-label="Billing period" {...stylex.props(styles.tabs)}>
        {(["monthly", "yearly"] as const).map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={billing === period}
            onClick={() => setBilling(period)}
            {...stylex.props(styles.tab, billing === period && styles.tabOn)}
          >
            {period === "monthly" ? "Monthly" : "Yearly"}
            {period === "yearly" && <span {...stylex.props(styles.save)}>2 months free</span>}
          </button>
        ))}
      </div>
      <ul {...stylex.props(styles.grid)}>
        <li {...stylex.props(styles.plan, styles.featured)}>
          <div {...stylex.props(styles.head)}>
            <h3 {...stylex.props(styles.name)}>Marketer</h3>
            <span {...stylex.props(styles.tag)}>Most popular</span>
          </div>
          <p {...stylex.props(styles.pitch)}>For one person marketing a business</p>
          <div {...stylex.props(styles.priceBlock)}>
            <p {...stylex.props(styles.price)}>
              <span {...stylex.props(styles.amount)}>{perMonth(MARKETER_MONTHLY, billing)}</span>
              <span {...stylex.props(styles.period)}>/month</span>
            </p>
            <p {...stylex.props(styles.billing)}>
              15 accounts, {billedAs(MARKETER_MONTHLY, billing)}
            </p>
          </div>
          <Trial signedIn={signedIn} />
          <Features items={MARKETER_FEATURES} />
        </li>

        <li {...stylex.props(styles.plan)}>
          <div {...stylex.props(styles.head)}>
            <h3 {...stylex.props(styles.name)}>Operator</h3>
          </div>
          <p {...stylex.props(styles.pitch)}>For those with an army of accounts</p>
          <div {...stylex.props(styles.priceBlock)}>
            <p {...stylex.props(styles.price)}>
              <span {...stylex.props(styles.amount)}>{perMonth(accounts, billing)}</span>
              <span {...stylex.props(styles.period)}>/month</span>
            </p>
            <p {...stylex.props(styles.billing)}>
              {accounts} accounts, {billedAs(accounts, billing)}
            </p>
          </div>
          <div {...stylex.props(styles.stepper)}>
            <div>
              <p {...stylex.props(styles.stepperLabel)}>Accounts</p>
              <p {...stylex.props(styles.stepperHint)}>
                {" "}
                {OPERATOR_MIN} minimum, {billing === "monthly" ? "$1" : "$10 a year"} each after
              </p>
            </div>
            <div {...stylex.props(styles.control)}>
              <button
                type="button"
                aria-label="Fewer accounts"
                disabled={accounts <= OPERATOR_MIN}
                onClick={() => step(-OPERATOR_STEP)}
                {...stylex.props(styles.stepButton)}
              >
                <Minus size={14} weight="bold" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={OPERATOR_MIN}
                aria-label="Accounts"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => setDraft(String(accounts))}
                {...stylex.props(styles.count)}
              />
              <button
                type="button"
                aria-label="More accounts"
                onClick={() => step(OPERATOR_STEP)}
                {...stylex.props(styles.stepButton)}
              >
                <Plus size={14} weight="bold" />
              </button>
            </div>
          </div>
          <Trial signedIn={signedIn} />
          <Features items={OPERATOR_FEATURES} />
        </li>
      </ul>
    </div>
  );
}
