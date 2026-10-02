import handler from "@tanstack/react-start/server-entry";

// Workflows are classes exported from the Worker entry; wrangler.jsonc binds this one.
export { PublishWorkflow } from "./modules/social/publish.workflow";
export { WebhookWorkflow } from "./modules/webhooks/webhook.workflow";
import { checkSocialAccess } from "./modules/social/social.scheduled";
import { expireStorage } from "./modules/storage/storage.scheduled";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/@")) {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = "/" + url.pathname.slice(2);
        const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
        return await (handler.fetch as any)(rewrittenRequest, env, ctx);
      }

      return (await (handler.fetch as any)(request, env, ctx)) as Response;
    } catch (err: any) {
      console.error("[Worker fetch error]:", err?.stack || err);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await Promise.all([
      expireStorage(controller, env, ctx),
      checkSocialAccess(controller, env, ctx),
    ]);
  },
};
