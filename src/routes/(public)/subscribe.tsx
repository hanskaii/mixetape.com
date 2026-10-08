import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { toast } from "sonner";
import { siteConfig } from "#/config/site";
import { Plans } from "#/components/marketing/plans";
import { PlansFaq } from "#/components/marketing/plans-faq";
import { Spinner } from "#/components/ui/spinner";
import { authClient } from "#/modules/auth/auth-client";
import { getBilling } from "#/modules/billing/billing.fn";
import { TRIAL_DAYS } from "#/modules/billing/plans";
import { colors } from "../../components/ui/tokens.stylex";

// Where the workspace sends someone signed in without a plan, and where checkout returns.
// It shows the plans in the site's own frame; once a plan exists it opens the workspace.
export const Route = createFileRoute("/(public)/subscribe")({
  validateSearch: (search: Record<string, unknown>): { checkout?: "done" } =>
    search.checkout === "done" ? { checkout: "done" } : {},
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/pricing" });
  },
  loader: async () => {
    const billing = await getBilling();
    if (billing.exempt || billing.plan) throw redirect({ to: "/publish" });
    return billing;
  },
  head: () => ({
    meta: [{ title: `Choose a plan | ${siteConfig.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: SubscribePage,
});

const STATUS: Record<string, string> = {
  on_hold: "on hold because the last payment failed",
  paused: "paused",
  past_due: "past due",
  pending: "starting",
  cancelled: "cancelled",
  expired: "expired",
  failed: "unpaid",
};

const styles = stylex.create({
  hero: { paddingBlockStart: { default: "2rem", "@media (min-width: 1024px)": "3rem" } },
  title: {
    fontSize: "clamp(2.5rem, 5vw, 4rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    marginBlock: 0,
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: "1.125rem",
    lineHeight: 1.5,
    marginBlockEnd: 0,
    marginBlockStart: "1rem",
    maxWidth: "640px",
  },
  notice: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: "14px",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    justifyContent: "space-between",
    paddingBlock: "0.875rem",
    paddingInline: "1.125rem",
  },
  noticeText: { fontSize: "0.9375rem", lineHeight: 1.5, marginBlock: 0 },
  button: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: "10px",
    borderWidth: 0,
    color: colors.background,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.5rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.875rem",
  },
  link: { color: colors.foreground, textDecoration: "underline", textUnderlineOffset: "4px" },
});

function SubscribePage() {
  const billing = Route.useLoaderData();
  const { checkout } = Route.useSearch();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  // Back from checkout, the subscription arrives by webhook a moment later: look again a few
  // times; the loader opens the workspace as soon as it is there.
  useEffect(() => {
    if (checkout !== "done") return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void router.invalidate();
      if (tries >= 12) clearInterval(timer);
    }, 2500);
    return () => clearInterval(timer);
  }, [checkout, router]);

  const openPortal = async () => {
    setOpening(true);
    const { data, error } = await authClient.dodopayments.customer.portal();
    if (error || !data?.url) {
      toast.error(error?.message || "Could not open billing");
      setOpening(false);
      return;
    }
    window.location.href = data.url;
  };

  const lastPlan = billing.status ? (STATUS[billing.status] ?? billing.status) : null;

  return (
    <>
      <section {...stylex.props(styles.hero)}>
        <h1 {...stylex.props(styles.title)}>Choose a plan to open your workspace</h1>
        <p {...stylex.props(styles.lede)}>
          {billing.status
            ? "Pick a plan and your channels, posts and files are where you left them."
            : `Your first plan starts with a ${TRIAL_DAYS}-day free trial. Your card is charged only when the trial ends, and you can cancel before then.`}
        </p>
      </section>

      {checkout === "done" ? (
        <div role="status" {...stylex.props(styles.notice)}>
          <p {...stylex.props(styles.noticeText)}>
            Checkout finished. Your workspace opens as soon as the payment confirms it, usually
            within a few seconds.
          </p>
          <Spinner />
        </div>
      ) : billing.open ? (
        <div {...stylex.props(styles.notice)}>
          <p {...stylex.props(styles.noticeText)}>
            Your plan is {lastPlan}. Pay the open invoice or update your card in the billing portal
            to open the workspace again.
          </p>
          {billing.available && (
            <button
              type="button"
              onClick={openPortal}
              disabled={opening}
              {...stylex.props(styles.button)}
            >
              {opening && <Spinner />} Open billing
            </button>
          )}
        </div>
      ) : (
        lastPlan && (
          <div {...stylex.props(styles.notice)}>
            <p {...stylex.props(styles.noticeText)}>
              Your last plan is {lastPlan}. Scheduled posts are paused and your channels and files
              are kept for 30 days after it ended. Past invoices are in{" "}
              <Link to="/settings/billing" {...stylex.props(styles.link)}>
                Billing
              </Link>
              .
            </p>
          </div>
        )
      )}

      {!billing.open && <Plans signedIn trial={!billing.status} />}
      <PlansFaq />
    </>
  );
}
