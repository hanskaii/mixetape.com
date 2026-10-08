import { expireLapsedWorkspaces, remindTrialsEnding } from "./lifecycle.service";

/**
 * Hourly: reminders for trials about to turn into a charge, and the warning and deletion for
 * workspaces 30 days without a plan (lifecycle.service). Each notice goes once.
 */
export async function runBillingLifecycle(
  _controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext,
) {
  ctx.waitUntil(
    remindTrialsEnding().then(({ sent }) => console.log(`[billing] ${sent} trial reminder(s)`)),
  );
  ctx.waitUntil(
    expireLapsedWorkspaces().then(({ warned, deleted }) =>
      console.log(`[billing] ${warned} deletion warning(s), ${deleted} workspace(s) cleared`),
    ),
  );
}
