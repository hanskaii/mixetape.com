import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/modules/auth/auth.server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const res = await auth.handler(request);
          return res;
        } catch (err: any) {
          console.error("[Better-Auth GET Error]:", err?.stack || err);
          return new Response(JSON.stringify({ error: err?.message || "Authentication error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        try {
          const res = await auth.handler(request);
          return res;
        } catch (err: any) {
          console.error("[Better-Auth POST Error]:", err?.stack || err);
          return new Response(JSON.stringify({ error: err?.message || "Authentication error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
