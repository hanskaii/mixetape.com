import { object } from "#/modules/api/input";
import { READ_ONLY, type Tool } from "#/modules/api/tool";
import { WEBHOOK_CHANGES, WEBHOOK_FIELDS } from "./webhooks.schemas";
import * as hooks from "./webhooks.service";

/**
 * Webhooks for agents: so a pipeline hears when its posts go live or fail instead of
 * polling list_posts. Field schemas are shared with the REST API (webhooks.schemas.ts).
 */

const WEBHOOK_ID = { type: "string", description: "Webhook id (list_webhooks)" };

export const webhookTools: Tool[] = [
  {
    name: "list_webhooks",
    scope: "webhooks",
    description: "List the webhooks, with the events each gets and how its last delivery went.",
    inputSchema: object({}),
    annotations: READ_ONLY,
    run: (userId) => hooks.listWebhooks(userId),
  },
  {
    name: "create_webhook",
    scope: "webhooks",
    description:
      "Add an https endpoint mixetape POSTs events to (post.uploaded, post.published, post.failed, post.cancelled, account.reconnect_needed), signed per Standard Webhooks. Answers { webhook, secret }: the secret is shown only now — hand it to whoever verifies the signatures.",
    inputSchema: object(WEBHOOK_FIELDS, ["url"]),
    run: (userId, input) =>
      hooks.createWebhook(userId, {
        url: input.string("url"),
        events: input.strings("events"),
        description: input.optionalString("description"),
      }),
  },
  {
    name: "update_webhook",
    scope: "webhooks",
    description:
      "Change a webhook: the given fields only; enabled: true turns one that was turned off back on.",
    inputSchema: object({ id: WEBHOOK_ID, ...WEBHOOK_CHANGES }, ["id"]),
    run: (userId, input) =>
      hooks.updateWebhook(userId, input.string("id"), {
        url: input.optionalString("url"),
        events: input.strings("events"),
        description: input.raw("description") === null ? null : input.optionalString("description"),
        enabled: input.boolean("enabled"),
      }),
  },
  {
    name: "delete_webhook",
    scope: "webhooks",
    description: "Delete a webhook; it stops receiving events at once.",
    inputSchema: object({ id: WEBHOOK_ID }, ["id"]),
    annotations: { destructiveHint: true },
    run: (userId, input) => hooks.deleteWebhook(userId, input.string("id")),
  },
  {
    name: "test_webhook",
    scope: "webhooks",
    description:
      "Send a webhook.test event to a webhook now, once, and answer how its endpoint responded.",
    inputSchema: object({ id: WEBHOOK_ID }, ["id"]),
    run: (userId, input) => hooks.testWebhook(userId, input.string("id")),
  },
];
