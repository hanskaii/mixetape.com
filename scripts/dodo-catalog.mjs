// Makes mixetape's plans in Dodo Payments: Marketer and Operator, monthly and yearly, each
// with a 7-day trial, plus the extra-account add-on Operator sells past its hundred
// accounts. Run it once per mode with that mode's API key:
//
//   DODO_PAYMENTS_API_KEY=… node scripts/dodo-catalog.mjs              (test mode)
//   DODO_PAYMENTS_API_KEY=… node scripts/dodo-catalog.mjs live_mode
//
// Anything already there under the same name is reused, so running it again is safe. It
// prints the DODO_CATALOG value for wrangler.jsonc (and .dev.vars), never the key.
// Prices and accounts mirror src/modules/billing/plans.ts.
import DodoPayments from "dodopayments";

const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
if (!bearerToken) {
  console.error("Set DODO_PAYMENTS_API_KEY to the mode's API key.");
  process.exit(1);
}
const environment = process.argv[2] === "live_mode" ? "live_mode" : "test_mode";
const dodo = new DodoPayments({ bearerToken, environment });

const TRIAL_DAYS = 7;
const YEAR_MONTHS = 10; // a year costs ten months

async function all(page) {
  const items = [];
  for await (const item of page) items.push(item);
  return items;
}

const existingAddons = await all(dodo.addons.list());
const existingProducts = await all(dodo.products.list());

async function addon(name, dollars) {
  const found = existingAddons.find((item) => item.name === name);
  if (found) return found.id;
  const created = await dodo.addons.create({
    name,
    price: dollars * 100,
    currency: "USD",
    tax_category: "saas",
    description: "One more social account on the Operator plan.",
  });
  return created.id;
}

async function plan(name, description, dollars, interval, addons = []) {
  const found = existingProducts.find((item) => item.name === name);
  if (found) return found.product_id;
  const created = await dodo.products.create({
    name,
    description,
    tax_category: "saas",
    addons,
    price: {
      type: "recurring_price",
      price: dollars * 100,
      currency: "USD",
      discount: 0,
      purchasing_power_parity: false,
      tax_inclusive: false,
      payment_frequency_count: 1,
      payment_frequency_interval: interval,
      // How long the subscription runs before it stops renewing: long enough to be ongoing.
      subscription_period_count: 20,
      subscription_period_interval: "Year",
      trial_period_days: TRIAL_DAYS,
    },
  });
  return created.product_id;
}

const extraMonthly = await addon("Extra account (monthly)", 1);
const extraYearly = await addon("Extra account (yearly)", YEAR_MONTHS);

const catalog = {
  marketer_monthly: await plan(
    "Marketer (monthly)",
    "15 social accounts, billed monthly.",
    39,
    "Month",
  ),
  marketer_yearly: await plan(
    "Marketer (yearly)",
    "15 social accounts, billed yearly.",
    39 * YEAR_MONTHS,
    "Year",
  ),
  operator_monthly: await plan(
    "Operator (monthly)",
    "100 social accounts, billed monthly; more at $1 each.",
    100,
    "Month",
    [extraMonthly],
  ),
  operator_yearly: await plan(
    "Operator (yearly)",
    "100 social accounts, billed yearly; more at $10 each.",
    100 * YEAR_MONTHS,
    "Year",
    [extraYearly],
  ),
  extra_account_monthly: extraMonthly,
  extra_account_yearly: extraYearly,
};

console.error(`Dodo Payments ${environment}: DODO_CATALOG is`);
process.stdout.write(`${JSON.stringify(catalog)}\n`);
