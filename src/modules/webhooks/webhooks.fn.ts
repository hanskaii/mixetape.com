import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import * as hooks from "./webhooks.service";

/** Server functions behind the Webhooks panel (API keys page). */

export const getWebhooks = createServerFn({ method: "GET" }).handler(async () => ({
  webhooks: await hooks.listWebhooks(await currentUserId()),
  events: hooks.WEBHOOK_EVENTS as Record<string, string>,
}));

export const addWebhook = createServerFn({ method: "POST" })
  .validator((data: { url: string; events: string[]; description?: string }) => data)
  .handler(async ({ data }) => hooks.createWebhook(await currentUserId(), data));

export const toggleWebhook = createServerFn({ method: "POST" })
  .validator((data: { id: string; enabled: boolean }) => data)
  .handler(async ({ data }) =>
    hooks.updateWebhook(await currentUserId(), data.id, { enabled: data.enabled }),
  );

export const removeWebhook = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => hooks.deleteWebhook(await currentUserId(), data.id));

export const sendTestEvent = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => hooks.testWebhook(await currentUserId(), data.id));
