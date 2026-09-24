import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/storage/file/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          if (!env.BUCKET) {
            return new Response("R2 bucket binding not configured", { status: 500 });
          }

          const key = params._splat;
          if (!key) {
            return new Response("File key is required", { status: 400 });
          }

          const object = await env.BUCKET.get(key);
          if (!object) {
            return new Response("File not found in R2 bucket", { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);
          headers.set("cache-control", "public, max-age=31536000, immutable");

          return new Response(object.body, {
            headers,
          });
        } catch (error: any) {
          return new Response(`Error retrieving file: ${error.message}`, { status: 500 });
        }
      },
    },
  },
});
