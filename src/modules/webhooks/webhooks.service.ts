import { env } from "cloudflare:workers";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "#/database/index";
import { webhooks, type JsonValue, type Webhook } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { decrypt, encrypt, sha256 } from "#/modules/secrets/crypto";

/**
 * Webhooks: an HTTPS endpoint of the user's, told when a post goes up, goes live, fails or
 * is cancelled, or a channel loses its access — so a pipeline need not poll. Deliveries
 * follow Standard Webhooks (standardwebhooks.com): a JSON body { type, timestamp, data }
 * and the headers webhook-id, webhook-timestamp and webhook-signature, an HMAC-SHA256 of
 * `${id}.${timestamp}.${body}` with the webhook's secret.
 *
 * Each event goes out through a WebhookWorkflow, which retries for about an hour; the
 * event id doubles as the workflow instance id, so one event is delivered once to each
 * endpoint however often it is announced. A webhook whose events keep failing every retry
 * is turned off after DISABLE_AFTER of them.
 */

export const WEBHOOK_EVENTS = {
  "post.uploaded": "A post is on the platform, waiting for its publish time",
  "post.published": "A post went live",
  "post.failed": "A post failed; its error says why",
  "post.cancelled": "A post was cancelled",
  "account.reconnect_needed": "A channel lost its access and must be connected again",
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;
export const EVENT_TYPES = Object.keys(WEBHOOK_EVENTS) as WebhookEventType[];
const isEventType = (value: string): value is WebhookEventType => value in WEBHOOK_EVENTS;

export type WebhookEnvelope = {
  id: string;
  type: WebhookEventType | "webhook.test";
  timestamp: string;
  data: Record<string, JsonValue>;
};

const MAX_WEBHOOKS = 10;
export const DISABLE_AFTER = 20;
const TIMEOUT_MS = 10_000;

// ── management ───────────────────────────────────────────────────────────────

export function webhookView(hook: Webhook) {
  return {
    id: hook.id,
    url: hook.url,
    description: hook.description,
    events: hook.events,
    enabled: hook.disabledAt === null,
    failures: hook.failures,
    lastDeliveryAt: hook.lastDeliveryAt,
    lastStatus: hook.lastStatus,
    lastError: hook.lastError,
    createdAt: hook.createdAt,
  };
}

function checkUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError("url must be an absolute URL", 400, {
      code: "invalid_field",
      field: "url",
    });
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new ServiceError("url must be https, without credentials", 400, {
      code: "invalid_field",
      field: "url",
    });
  return parsed.toString();
}

function checkEvents(events: string[] | undefined) {
  const chosen = [...new Set(events ?? EVENT_TYPES)];
  const unknown = chosen.find((event) => !isEventType(event));
  if (unknown)
    throw new ServiceError(`Unknown event: ${unknown}. Events: ${EVENT_TYPES.join(", ")}`, 400, {
      code: "invalid_field",
      field: "events",
    });
  if (!chosen.length)
    throw new ServiceError("Choose at least one event", 400, {
      code: "missing_field",
      field: "events",
    });
  return chosen;
}

const newSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${btoa(String.fromCharCode(...bytes))}`;
};

async function ownedWebhook(userId: string, id: string) {
  const hook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
  });
  if (!hook) throw new ServiceError("Webhook not found", 404);
  return hook;
}

export async function listWebhooks(userId: string) {
  const rows = await db.query.webhooks.findMany({
    where: eq(webhooks.userId, userId),
    orderBy: [asc(webhooks.createdAt)],
  });
  return rows.map(webhookView);
}

export async function getWebhook(userId: string, id: string) {
  return webhookView(await ownedWebhook(userId, id));
}

/** Adds an endpoint; its signing secret is in the answer, the only time it is shown. */
export async function createWebhook(
  userId: string,
  input: { url: string; events?: string[]; description?: string | null },
) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhooks)
    .where(eq(webhooks.userId, userId));
  if (count >= MAX_WEBHOOKS)
    throw new ServiceError(`At most ${MAX_WEBHOOKS} webhooks; delete one first`, 409, {
      code: "conflict",
    });
  const secret = newSecret();
  const [hook] = await db
    .insert(webhooks)
    .values({
      id: crypto.randomUUID(),
      userId,
      url: checkUrl(input.url),
      description: input.description?.trim() || null,
      events: checkEvents(input.events),
      secret: await encrypt(secret),
    })
    .returning();
  return { webhook: webhookView(hook), secret };
}

/** Changes the given fields; turning a webhook back on clears its failure count. */
export async function updateWebhook(
  userId: string,
  id: string,
  changes: { url?: string; events?: string[]; description?: string | null; enabled?: boolean },
) {
  await ownedWebhook(userId, id);
  const [hook] = await db
    .update(webhooks)
    .set({
      ...(changes.url !== undefined && { url: checkUrl(changes.url) }),
      ...(changes.events !== undefined && { events: checkEvents(changes.events) }),
      ...(changes.description !== undefined && {
        description: changes.description?.trim() || null,
      }),
      ...(changes.enabled === true && { disabledAt: null, failures: 0 }),
      ...(changes.enabled === false && { disabledAt: new Date() }),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, id))
    .returning();
  return webhookView(hook);
}

export async function deleteWebhook(userId: string, id: string) {
  await ownedWebhook(userId, id);
  await db.delete(webhooks).where(eq(webhooks.id, id));
  return { deleted: true as const, id };
}

// ── signing and delivery ─────────────────────────────────────────────────────

/** The Standard Webhooks signature: v1,base64(HMAC-SHA256(key, id.timestamp.body)). */
export async function sign(secret: string, id: string, timestamp: number, body: string) {
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
}

/** Posts one event to one endpoint; the HTTP status, or the error that stopped it. */
async function send(hook: Webhook, envelope: WebhookEnvelope) {
  const body = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sign(await decrypt(hook.secret), envelope.id, timestamp, body);
  try {
    const response = await fetch(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "mixetape-webhooks/1",
        "webhook-id": envelope.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": signature,
      },
      body,
    });
    await response.body?.cancel();
    return response.ok
      ? { ok: true as const, status: response.status }
      : { ok: false as const, status: response.status, error: `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, status: null, error: message.slice(0, 300) };
  }
}

async function record(hook: Webhook, result: Awaited<ReturnType<typeof send>>) {
  await db
    .update(webhooks)
    .set({
      lastDeliveryAt: new Date(),
      lastStatus: result.status,
      lastError: result.ok ? null : result.error,
      ...(result.ok && { failures: 0 }),
    })
    .where(eq(webhooks.id, hook.id));
}

/**
 * One delivery attempt, from the workflow: "gone" when the webhook was deleted or turned
 * off since; throws on failure so the workflow retries.
 */
export async function deliver(webhookId: string, envelope: WebhookEnvelope) {
  const hook = await db.query.webhooks.findFirst({ where: eq(webhooks.id, webhookId) });
  if (
    !hook ||
    hook.disabledAt ||
    (envelope.type !== "webhook.test" && !hook.events.includes(envelope.type))
  )
    return "gone" as const;
  const result = await send(hook, envelope);
  await record(hook, result);
  if (!result.ok) throw new Error(`${hook.url} answered ${result.error}`);
  return "delivered" as const;
}

/** Every retry failed: counts it, and turns the webhook off after DISABLE_AFTER in a row. */
export async function recordUndelivered(webhookId: string) {
  await db
    .update(webhooks)
    .set({
      failures: sql`${webhooks.failures} + 1`,
      disabledAt: sql`CASE WHEN ${webhooks.failures} + 1 >= ${DISABLE_AFTER} THEN ${Date.now()} ELSE ${webhooks.disabledAt} END`,
    })
    .where(eq(webhooks.id, webhookId));
}

/** Sends a webhook.test event now, without retries, and says how it went. */
export async function testWebhook(userId: string, id: string) {
  const hook = await ownedWebhook(userId, id);
  const envelope: WebhookEnvelope = {
    id: `evt_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
    type: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { webhookId: hook.id },
  };
  const result = await send(hook, envelope);
  await record(hook, result);
  return { delivered: result.ok, status: result.status, error: result.ok ? null : result.error };
}

/**
 * Announces an event to the user's webhooks that want it. `key` names the occurrence (say
 * the post, its status and attempt): the same key always gives the same event id, so an
 * event announced twice is still delivered once. Never throws — an event that cannot be
 * queued is logged, not allowed to fail what caused it.
 */
export async function emitEvent(
  userId: string,
  type: WebhookEventType,
  data: Record<string, JsonValue>,
  key: string,
) {
  try {
    const hooks = (
      await db.query.webhooks.findMany({
        where: and(eq(webhooks.userId, userId), isNull(webhooks.disabledAt)),
      })
    ).filter((hook) => hook.events.includes(type));
    if (!hooks.length) return;
    const id = `evt_${(await sha256(`${type}:${key}`)).slice(0, 24)}`;
    const envelope: WebhookEnvelope = { id, type, timestamp: new Date().toISOString(), data };
    await Promise.all(
      hooks.map((hook) =>
        env.WEBHOOK_WORKFLOW.create({
          id: `${hook.id}-${id}`,
          params: { webhookId: hook.id, event: envelope },
        }).catch((error: unknown) => {
          // Already queued: the same event, announced again.
          if (!String(error).includes("already exists")) throw error;
        }),
      ),
    );
  } catch (error) {
    console.error(`[webhooks] could not queue ${type} for ${key}:`, error);
  }
}
