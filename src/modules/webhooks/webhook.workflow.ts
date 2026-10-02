import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { deliver, recordUndelivered, type WebhookEnvelope } from "./webhooks.service";

export type WebhookDelivery = { webhookId: string; event: WebhookEnvelope };

/**
 * Delivers one event to one webhook, retrying with backoff for about an hour (30 s, 1, 2,
 * 4, 8, 16 and 32 min). Its instance id is the webhook and event, so an event announced
 * twice is not delivered twice. Undelivered after every retry, it counts against the
 * webhook, which turns off after enough of them (webhooks.service).
 */
export class WebhookWorkflow extends WorkflowEntrypoint<Env, WebhookDelivery> {
  async run(event: WorkflowEvent<WebhookDelivery>, step: WorkflowStep) {
    const { webhookId, event: envelope } = event.payload;
    try {
      return await step.do(
        "deliver",
        {
          retries: { limit: 7, delay: "30 seconds", backoff: "exponential" },
          timeout: "30 seconds",
        },
        () => deliver(webhookId, envelope),
      );
    } catch {
      await step.do("record undelivered", () => recordUndelivered(webhookId));
      return "undelivered";
    }
  }
}
