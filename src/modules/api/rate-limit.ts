import { env } from "cloudflare:workers";
import { ServiceError } from "./errors";

/** Seconds a limited caller should wait: the limiter counts per minute. */
export const RETRY_AFTER_SECONDS = 60;

/**
 * Counts one API call (REST endpoint or MCP tool) against the user's allowance: 120 a minute
 * (wrangler.jsonc `ratelimits`). Over it, the call is refused with 429 and Retry-After, so an
 * agent stuck in a loop slows down instead of hammering the platforms behind mixetape.
 */
export async function countCall(userId: string) {
  const limiter = env.API_RATE_LIMIT as RateLimit | undefined;
  // Unit tests run without the binding.
  if (!limiter) return;
  const { success } = await limiter.limit({ key: userId });
  if (!success)
    throw new ServiceError(
      `Too many requests: up to 120 a minute. Wait ${RETRY_AFTER_SECONDS} seconds and try again.`,
      429,
      { code: "rate_limited" },
    );
}
