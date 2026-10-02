import { checkRevokedAccess, deleteRevokedAccounts } from "./access.service";

/** The hour (UTC) of the daily access check; the cron runs hourly. */
const CHECK_HOUR = 3;

/**
 * Hourly: deletes channels whose revoked access was not restored in time; once a day, asks
 * YouTube whether each connected channel's access still stands (social/access.service).
 */
export async function checkSocialAccess(
  controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext,
) {
  if (new Date(controller.scheduledTime).getUTCHours() === CHECK_HOUR)
    ctx.waitUntil(
      checkRevokedAccess().then(({ checked, revoked }) =>
        console.log(`[access] checked ${checked} channel(s), ${revoked} revoked`),
      ),
    );
  ctx.waitUntil(
    deleteRevokedAccounts().then(({ deleted }) =>
      console.log(`[access] deleted ${deleted} revoked channel(s)`),
    ),
  );
}
