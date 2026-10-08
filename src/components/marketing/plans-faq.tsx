import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Plus } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import {
  DATA_KEPT_DAYS,
  PLANS,
  POSTS_PER_CHANNEL_DAY,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
  WARNING_DAYS,
} from "#/modules/billing/plans";
import { colors } from "../ui/tokens.stylex";

// Every answer describes what mixetape does today (billing.service, lifecycle.service,
// social.service, the Terms); change them together.
const QUESTIONS = [
  {
    q: "Why mixetape instead of Buffer or Hootsuite?",
    a: "mixetape is built for posting through AI agents, not for a team clicking through a dashboard. Claude Code, Codex, Cursor or your own script schedules the posts through MCP or the REST API, and you see, edit or cancel every one of them in the queue. No seats, no approval flows: you pay for the accounts you post to, and posts are unlimited.",
  },
  {
    q: "Which platforms do you support?",
    a: "YouTube, TikTok, Instagram, Facebook Pages, Threads, Pinterest, Bluesky and Mastodon. Want another one? Email us.",
  },
  {
    q: "How many social accounts can I connect?",
    a: `Creator includes ${PLANS.creator.accounts}, enough for one business on every platform. Studio starts at ${PLANS.studio.accounts} accounts for $${PLANS.studio.monthly} a month and adds $${PLANS.studio.extraMonthly} for each account after that.`,
  },
  {
    q: "What is a social account?",
    a: "One channel you connect: a YouTube channel, an Instagram account, a Facebook Page. Connecting your Instagram account is one social account.",
  },
  {
    q: "Can I connect several accounts on the same platform?",
    a: `Yes. The count is across every platform: on Creator all ${PLANS.creator.accounts} can be TikTok accounts, or 10 TikTok and 5 Instagram.`,
  },
  {
    q: "How many posts can I schedule?",
    a: `Unlimited, on every plan. One post to 4 channels counts as 4 posts. So your channels don't look like spam to the platforms, each channel can have up to ${POSTS_PER_CHANNEL_DAY} posts a day.`,
  },
  {
    q: "What can I post?",
    a: "Videos, images and carousels. On YouTube you also set the title, thumbnail, playlist, captions, tags and first comment. Each platform's own rules, like YouTube's daily upload limit, still apply.",
  },
  {
    q: "Is there a free plan?",
    a: `No, but your first plan starts with a ${TRIAL_DAYS}-day free trial. You add a card, pay $0 today, and we email you ${TRIAL_REMINDER_DAYS} days before the first charge. Cancel before then and you pay nothing.`,
  },
  {
    q: "Can I cancel anytime?",
    a: `Yes, from Billing, with no lock-in. Your plan keeps working until the end of the period you paid for. After that your posts pause and your channels, posts and files are kept for ${DATA_KEPT_DAYS} days, so you can come back to everything as you left it. We email you ${WARNING_DAYS} days before they are deleted.`,
  },
  {
    q: "Can I get a refund?",
    a: "Periods you have paid for are not refunded. If you were charged by mistake, or could not use mixetape because of a fault on our side, email us within 14 days of the charge and we will put it right.",
  },
  {
    q: "Do I share my social media passwords with you?",
    a: "No. You sign in on each platform's own page, and it gives mixetape access to post for you. That access is stored encrypted, and you can remove it any time by disconnecting the channel or from the platform's settings.",
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
          Frequently asked questions
        </h2>
        <p {...stylex.props(styles.note)}>
          Another question? Email us:{" "}
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
