import { expireIdempotencyKeys } from "#/modules/api/idempotency.service";
import { expireFiles } from "./files.service";

/**
 * Hourly: storage lets go of files stored over 24 hours ago that no post needs, and the API
 * forgets idempotency keys older than 24 hours.
 */
export async function expireStorage(
  _controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext,
) {
  ctx.waitUntil(
    expireFiles().then(({ deleted }) => console.log(`[storage] expired ${deleted} file(s)`)),
  );
  ctx.waitUntil(
    expireIdempotencyKeys().then(({ deleted }) =>
      console.log(`[api] forgot ${deleted} idempotency key(s)`),
    ),
  );
}
