import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import {
  LocalTime,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { authClient } from "#/modules/auth/auth-client";
import { getBilling } from "#/modules/billing/billing.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/settings/billing")({
  validateSearch: (search: Record<string, unknown>): { checkout?: "done" } =>
    search.checkout === "done" ? { checkout: "done" } : {},
  loader: () => getBilling(),
  head: () => ({
    meta: [
      { title: `Billing | ${siteConfig.name}` },
      { name: "description", content: "Your plan, its accounts, and invoices." },
    ],
  }),
  component: BillingPage,
});

const DATE: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

const STATUS: Record<string, string> = {
  active: "Active",
  on_hold: "On hold: the last payment failed",
  paused: "Paused",
  cancelled: "Cancelled",
  failed: "Payment failed",
  expired: "Expired",
  past_due: "Past due",
  pending: "Starting",
};

function BillingPage() {
  const billing = Route.useLoaderData();
  const { checkout } = Route.useSearch();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  // Back from checkout, the subscription arrives by webhook a moment later: look again a few
  // times until it shows.
  useEffect(() => {
    if (checkout !== "done" || billing.plan) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void router.invalidate();
      if (tries >= 6) clearInterval(timer);
    }, 2500);
    return () => clearInterval(timer);
  }, [checkout, billing.plan, router]);

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

  const manage = (
    <Button size="sm" variant="outline" onClick={openPortal} disabled={opening}>
      {opening && <Spinner />} Invoices and payment method
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title="Billing"
        description="Your plan, how many social accounts it covers, and its invoices."
      />

      {checkout === "done" && !billing.plan && (
        <Notice>Checkout finished. Your plan appears here as soon as payment confirms it.</Notice>
      )}

      {billing.exempt ? (
        <Panel title="Plan">
          <Rows>
            <Row title="No plan needed" meta="This account publishes without a subscription." />
          </Rows>
        </Panel>
      ) : billing.plan ? (
        <Panel title="Plan" actions={billing.available ? manage : undefined}>
          <Rows>
            <Row
              title={`${billing.plan.name}, billed ${billing.plan.period}`}
              meta={STATUS[billing.status ?? ""] ?? billing.status}
            />
            <Row
              title={`${billing.connected} of ${billing.plan.accounts} social accounts`}
              meta={
                billing.connected > billing.plan.accounts
                  ? "More channels are connected than the plan covers; scheduling is paused until some are disconnected or the plan grows."
                  : "Connected channels, across every platform."
              }
            />
            {billing.nextBillingAt && (
              <Row
                title={
                  <>
                    {billing.cancelAtPeriodEnd ? "Ends on " : "Renews on "}
                    <LocalTime date={billing.nextBillingAt} format={DATE} />
                  </>
                }
                meta={
                  billing.cancelAtPeriodEnd
                    ? "Cancelled: it stays active until then."
                    : "The trial converts on this date unless you cancel first."
                }
              />
            )}
          </Rows>
        </Panel>
      ) : (
        <Panel title="Plan">
          <Rows>
            <Row
              title="No plan yet"
              meta={
                billing.status
                  ? `Your last plan is ${(STATUS[billing.status] ?? billing.status).toLowerCase()}. Scheduling posts needs an active one.`
                  : "Everything works except scheduling posts, which needs a plan. Every plan starts with a free trial."
              }
            >
              <Button size="sm" render={<Link to="/pricing" />}>
                Choose a plan
              </Button>
            </Row>
          </Rows>
        </Panel>
      )}

      {!billing.exempt && !billing.plan && billing.status && billing.available && (
        <Panel title="Past invoices" actions={manage}>
          <Rows>
            <Row title="Invoices and payment methods are in the billing portal." />
          </Rows>
        </Panel>
      )}
    </Page>
  );
}
