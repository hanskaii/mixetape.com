import { and, eq, lt } from "drizzle-orm";
import { db } from "#/database";
import { idempotencyKeys } from "#/database/schema";
import { sha256 } from "#/modules/secrets/crypto";
import { ServiceError } from "./errors";

/**
 * Idempotency for writes an agent may send twice — a retry after a dropped connection must
 * not schedule a second post. The first request with a key runs; its answer is kept for 24
 * hours and handed back to every retry with the same key. The same key with a different
 * request is refused, and so is a retry while the first is still running. A request that
 * fails lets its key go, so it can be tried again.
 */

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 255;

export type Answer = { status: number; body: unknown };

function checkKey(key: string, field: string) {
  if (!key.trim() || key.length > MAX_KEY_LENGTH)
    throw new ServiceError(`${field} must be 1–${MAX_KEY_LENGTH} characters`, 400, {
      code: "invalid_field",
      field,
    });
}

/**
 * Runs `run` once per (user, key). `request` is what the call asked for — the same key with
 * another request is refused. `field` names where the key came from, for error messages.
 */
export async function once(
  userId: string,
  key: string | undefined,
  request: unknown,
  run: () => Promise<Answer>,
  field = "Idempotency-Key",
): Promise<Answer & { replayed: boolean }> {
  if (key === undefined) return { ...(await run()), replayed: false };
  checkKey(key, field);
  const fingerprint = await sha256(JSON.stringify(request));
  const where = and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key));

  const claimed = await db
    .insert(idempotencyKeys)
    .values({ userId, key, fingerprint })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (!claimed.length) {
    const [earlier] = await db.select().from(idempotencyKeys).where(where);
    // Expired but not yet swept: the key is free again.
    if (earlier && earlier.createdAt.getTime() < Date.now() - IDEMPOTENCY_TTL_MS) {
      await db.delete(idempotencyKeys).where(where);
      return once(userId, key, request, run, field);
    }
    if (!earlier) return once(userId, key, request, run, field);
    if (earlier.fingerprint !== fingerprint)
      throw new ServiceError(
        `This ${field} was already used for a different request; use a new key for a new request`,
        422,
        { code: "idempotency_key_reused", field },
      );
    if (earlier.status === null)
      throw new ServiceError(
        "The first request with this key is still running; retry in a few seconds",
        409,
        { code: "idempotency_in_progress", field },
      );
    return { status: earlier.status, body: earlier.response, replayed: true };
  }

  try {
    const answer = await run();
    await db
      .update(idempotencyKeys)
      .set({ status: answer.status, response: answer.body })
      .where(where);
    return { ...answer, replayed: false };
  } catch (error) {
    await db.delete(idempotencyKeys).where(where);
    throw error;
  }
}

/** Drops keys older than 24 hours (hourly cron). */
export async function expireIdempotencyKeys() {
  const gone = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - IDEMPOTENCY_TTL_MS)))
    .returning({ key: idempotencyKeys.key });
  return { deleted: gone.length };
}
