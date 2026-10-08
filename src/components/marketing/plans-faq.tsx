import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Plus } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import {
  DATA_KEPT_DAYS,
  MONTHS_PAID_YEARLY,
  PLANS,
  POSTS_PER_CHANNEL_DAY,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
  WARNING_DAYS,
} from "#/modules/billing/plans";
import { colors } from "../ui/tokens.stylex";

// Every answer describes what the code does today (billing.service, lifecycle.service,
// social.service); change them together.
const QUESTIONS = [
  {
    q: "What counts as a social account?",
    a: "Each channel you connect: a YouTube channel, a Facebook Page, an Instagram or TikTok account, and so on. They add up across every platform. Reconnecting a channel you already have does not count again.",
  },
  {
    q: "How does the free trial work?",
    a: `Your first plan starts with a ${TRIAL_DAYS}-day free trial. You add a card at checkout, nothing is charged today, and the first charge is made when the trial ends unless you cancel before. We email you ${TRIAL_REMINDER_DAYS} days before it ends. The trial is given once per account.`,
  },
  {
    q: "Can I use mixetape without a plan?",
    a: "You can sign in, choose a plan and see your billing, but the workspace, the REST API and the MCP server need an active plan, trial included.",
  },
  {
    q: "How is Studio priced?",
    a: `$${PLANS.studio.monthly} a month covers ${PLANS.studio.accounts} social accounts, and each account after that is $${PLANS.studio.extraMonthly} a month. Pick the number on the plan card before checkout.`,
  },
  {
    q: "What do I save by paying yearly?",
    a: `A year costs ${MONTHS_PAID_YEARLY} months, so two months are free. It is charged once a year in advance.`,
  },
  {
    q: "Can I change plans later?",
    a: "Yes, from Billing in your workspace. If you move to a plan that covers fewer accounts than you have connected, the most recently connected channels are locked and their posts pause; you choose which channels stay active, or disconnect the ones you no longer use.",
  },
  {
    q: "Is there a limit on posts?",
    a: `Scheduled posts are unlimited. To keep channels from looking like spam to the platforms, one channel can have at most ${POSTS_PER_CHANNEL_DAY} posts on the same day. Each platform's own limits, like YouTube's daily upload quota, still apply.`,
  },
  {
    q: "Can my AI agent use it?",
    a: "Every plan includes the MCP server for Claude Code, Codex, Cursor and other agents, and the REST API. API keys are unlimited, and each has its own permissions.",
  },
  {
    q: "What happens if I cancel?",
    a: `Your plan stays active until the end of the period you paid for. After that the workspace closes and scheduled posts pause instead of going out. Your channels, posts and files are kept for ${DATA_KEPT_DAYS} days: subscribe again before then and everything is where you left it, with paused posts ready to send. After ${DATA_KEPT_DAYS} days they are deleted; we email you ${WARNING_DAYS} days before. Your sign-in and invoices stay.`,
  },
  {
    q: "Who handles payment and invoices?",
    a: "Dodo Payments, our merchant of record: it charges your card, adds any sales tax or VAT, and issues the invoices, which you find in Billing. mixetape never sees your card number. Paid periods are not refunded, but if you were charged by mistake, write to us within 14 days.",
  },
] as const;

const styles = stylex.create({
  section: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "grid",
    gap: "2rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "0.7fr 1.3fr" },
    paddingBlock: "4rem",
  },
  title: {
    fontSize: "clamp(2rem, 3.5vw, 3rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    marginBlock: 0,
  },
  note: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "1rem",
  },
  mail: { color: colors.foreground, textDecoration: "underline", textUnderlineOffset: "4px" },
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
  },
  summary: {
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    fontSize: "1.0625rem",
    fontWeight: 600,
    gap: "1rem",
    justifyContent: "space-between",
    letterSpacing: "-0.015em",
    listStyle: "none",
    "::-webkit-details-marker": { display: "none" },
    outlineColor: colors.ring,
    outlineOffset: "2px",
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: "2px",
    paddingBlock: "1.125rem",
  },
  icon: {
    color: colors.mutedForeground,
    flexShrink: 0,
    transitionDuration: "180ms",
    transitionProperty: "transform",
  },
  iconOpen: { transform: "rotate(45deg)" },
  answer: {
    color: colors.mutedForeground,
    fontSize: "0.9375rem",
    lineHeight: 1.65,
    marginBlockEnd: "1.25rem",
    marginBlockStart: 0,
    maxWidth: "40rem",
  },
});

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary {...stylex.props(styles.summary)}>
        {q}
        <Plus
          size={18}
          weight="bold"
          aria-hidden
          {...stylex.props(styles.icon, open && styles.iconOpen)}
        />
      </summary>
      <p {...stylex.props(styles.answer)}>{a}</p>
    </details>
  );
}

/** Questions about the plans and what happens around them, for the pricing and subscribe pages. */
export function PlansFaq() {
  return (
    <section {...stylex.props(styles.section)} aria-labelledby="plans-faq">
      <div>
        <h2 id="plans-faq" {...stylex.props(styles.title)}>
          Questions
        </h2>
        <p {...stylex.props(styles.note)}>
          Something else?{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} {...stylex.props(styles.mail)}>
            {siteConfig.contactEmail}
          </a>
        </p>
      </div>
      <ul {...stylex.props(styles.list)}>
        {QUESTIONS.map(({ q, a }) => (
          <li key={q} {...stylex.props(styles.item)}>
            <Question q={q} a={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
