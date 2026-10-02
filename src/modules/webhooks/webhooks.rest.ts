import { object } from "#/modules/api/input";
import type { Endpoint } from "#/modules/api/rest";
import { SECRET, TEST_RESULT, WEBHOOK, WEBHOOK_CHANGES, WEBHOOK_FIELDS } from "./webhooks.schemas";
import * as hooks from "./webhooks.service";

/** Webhooks as REST resources: endpoints told when posts and channels change. */

const WEBHOOK_ID = { id: "The webhook's id" };
const ONE = object({ webhook: WEBHOOK }, ["webhook"]);

export const webhookEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/webhooks",
    operationId: "listWebhooks",
    tag: "Webhooks",
    scope: "webhooks",
    summary: "List webhooks",
    description: "Every webhook, with how its last delivery went.",
    response: {
      description: "The webhooks.",
      schema: object({ webhooks: { type: "array", items: WEBHOOK } }, ["webhooks"]),
    },
    run: async (userId) => ({ webhooks: await hooks.listWebhooks(userId) }),
  },
  {
    method: "POST",
    path: "/webhooks",
    operationId: "createWebhook",
    tag: "Webhooks",
    scope: "webhooks",
    summary: "Create a webhook",
    description:
      "An https endpoint mixetape POSTs events to, signed per Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature). The answer holds its secret, shown only this once.",
    body: object(WEBHOOK_FIELDS, ["url"]),
    status: 201,
    response: {
      description: "The new webhook and its signing secret.",
      schema: object({ webhook: WEBHOOK, secret: SECRET }, ["webhook", "secret"]),
    },
    errors: [409],
    run: (userId, input) =>
      hooks.createWebhook(userId, {
        url: input.string("url"),
        events: input.strings("events"),
        description: input.optionalString("description"),
      }),
  },
  {
    method: "GET",
    path: "/webhooks/{id}",
    operationId: "getWebhook",
    tag: "Webhooks",
    scope: "webhooks",
    params: WEBHOOK_ID,
    summary: "Get a webhook",
    description: "One webhook, with how its last delivery went.",
    response: { description: "The webhook.", schema: ONE },
    errors: [404],
    run: async (userId, input) => ({ webhook: await hooks.getWebhook(userId, input.string("id")) }),
  },
  {
    method: "PATCH",
    path: "/webhooks/{id}",
    operationId: "updateWebhook",
    tag: "Webhooks",
    scope: "webhooks",
    params: WEBHOOK_ID,
    summary: "Change a webhook",
    description:
      "The given fields only; enabled: true turns a webhook that was turned off back on.",
    body: object(WEBHOOK_CHANGES),
    response: { description: "The webhook.", schema: ONE },
    errors: [404],
    run: async (userId, input) => ({
      webhook: await hooks.updateWebhook(userId, input.string("id"), {
        url: input.optionalString("url"),
        events: input.strings("events"),
        description: input.raw("description") === null ? null : input.optionalString("description"),
        enabled: input.boolean("enabled"),
      }),
    }),
  },
  {
    method: "DELETE",
    path: "/webhooks/{id}",
    operationId: "deleteWebhook",
    tag: "Webhooks",
    scope: "webhooks",
    params: WEBHOOK_ID,
    summary: "Delete a webhook",
    description: "It stops receiving events at once.",
    response: {
      description: "Deleted.",
      schema: object({ deleted: { type: "boolean" }, id: { type: "string" } }, ["deleted", "id"]),
    },
    errors: [404],
    run: (userId, input) => hooks.deleteWebhook(userId, input.string("id")),
  },
  {
    method: "POST",
    path: "/webhooks/{id}/test",
    operationId: "testWebhook",
    tag: "Webhooks",
    scope: "webhooks",
    params: WEBHOOK_ID,
    summary: "Send a test event",
    description: "POSTs a webhook.test event now, once, and answers how the endpoint responded.",
    response: { description: "How the delivery went.", schema: TEST_RESULT },
    errors: [404],
    run: (userId, input) => hooks.testWebhook(userId, input.string("id")),
  },
];
