import { expireFiles } from "./files.service";

/** Daily: storage lets go of files older than 30 days that no post still needs. */
export async function expireStorage(
  _controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext,
) {
  ctx.waitUntil(
    expireFiles().then(({ deleted }) => console.log(`[storage] expired ${deleted} file(s)`)),
  );
}
