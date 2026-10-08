import { env } from "cloudflare:workers";
import { secret } from "#/modules/secrets/secrets.service";

/**
 * What stands between the sign-in form and an email being sent: a Cloudflare Turnstile check
 * (the form's widget, action `sign-in`) and limits on how often a code can be asked for, so
 * the form cannot be used to flood someone's inbox or spend mixetape's email reputation.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** A sign-in code per address at most once a minute, 5 an hour; 20 an hour per IP. */
export const CODE_LIMITS = { perEmailHour: 5, perIpHour: 20, emailGapSeconds: 60 } as const;

/**
 * mixetape's own test inboxes (Email Routing → the QA inbox worker): automated tests sign in
 * with them, so they skip the Turnstile check. The rate limits still apply.
 */
export const isQaInbox = (email: string) => /^qa-[a-z0-9-]+@mixetape\.com$/.test(email);

/** The frontend hostnames this deployment serves the sign-in form from. */
function expectedHostnames() {
  return new Set(
    String(env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}

/**
 * Whether a Turnstile token is genuine, fresh, for this action and from our own pages.
 * Fails closed: no secret, no hostnames, a network error or an odd answer all mean no.
 */
export async function verifyTurnstile(token: unknown, ip: string, action: string) {
  const turnstileSecret = await secret("TURNSTILE_SECRET");
  const hostnames = expectedHostnames();
  if (
    !turnstileSecret ||
    !hostnames.size ||
    typeof token !== "string" ||
    !token ||
    token.length > 2048
  )
    return false;
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        ...(ip && { remoteip: ip }),
      }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    return (
      result.success === true &&
      result.action === action &&
      Boolean(result.hostname && hostnames.has(result.hostname))
    );
  } catch {
    return false;
  }
}

const hour = () => Math.floor(Date.now() / 3_600_000);

async function bump(key: string) {
  const count = Number((await env.KIT_CACHE.get(key)) ?? 0) + 1;
  await env.KIT_CACHE.put(key, String(count), { expirationTtl: 3600 });
  return count;
}

/**
 * Counts a request for a sign-in code and answers why it is refused, or null when it may go
 * ahead. KV counters are approximate under concurrency, which is fine for a limit like this.
 */
export async function codeRequestRefusal(email: string, ip: string): Promise<string | null> {
  const recent = `signin:recent:${email}`;
  if (email && (await env.KIT_CACHE.get(recent)))
    return "A code was just sent to this address. Wait a minute before asking for another.";
  if (ip && (await bump(`signin:ip:${ip}:${hour()}`)) > CODE_LIMITS.perIpHour)
    return "Too many sign-in attempts from this network. Try again in an hour.";
  if (email && (await bump(`signin:email:${email}:${hour()}`)) > CODE_LIMITS.perEmailHour)
    return "Too many codes for this address. Try again in an hour.";
  if (email) await env.KIT_CACHE.put(recent, "1", { expirationTtl: CODE_LIMITS.emailGapSeconds });
  return null;
}
