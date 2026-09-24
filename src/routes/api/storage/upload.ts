import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { auth } from "#/modules/auth/auth.server";
import { MEDIA_PREFIX, deleteOwnedMedia, listOwnedMedia } from "#/modules/storage/storage.service";

export const Route = createFileRoute("/api/storage/upload")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
          if (!session?.user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          if (!env.BUCKET) {
            return Response.json(
              { error: "Storage bucket binding not configured" },
              { status: 500 },
            );
          }

          const url = new URL(request.url);
          const subPrefix = url.searchParams.get("prefix") || "";

          const objects = await listOwnedMedia(session.user.id, subPrefix);

          return Response.json({ objects });
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
          if (!session?.user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          if (!env.BUCKET) {
            return Response.json(
              { error: "Storage bucket binding not configured" },
              { status: 500 },
            );
          }

          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          if (!file) {
            return Response.json({ error: "No file provided in form data" }, { status: 400 });
          }

          const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const key = `${MEDIA_PREFIX}${Date.now()}-${sanitizedFilename}`;
          const buffer = await file.arrayBuffer();

          await env.BUCKET.put(key, buffer, {
            httpMetadata: {
              contentType: file.type || "application/octet-stream",
            },
            customMetadata: {
              originalName: file.name,
              userId: session.user.id,
              uploadedAt: new Date().toISOString(),
            },
          });

          return Response.json({
            success: true,
            key,
            size: file.size,
            type: file.type,
            url: `/api/storage/file/${encodeURIComponent(key)}`,
          });
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
          if (!session?.user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          if (!env.BUCKET) {
            return Response.json(
              { error: "Storage bucket binding not configured" },
              { status: 500 },
            );
          }

          const body = (await request.json().catch(() => ({}))) as { keys?: string[] };
          const keys = body.keys || [];
          if (!keys.length) {
            return Response.json({ error: "No keys provided to delete" }, { status: 400 });
          }

          const { deleted, refused } = await deleteOwnedMedia(keys, session.user.id);

          if (!deleted) {
            return Response.json(
              { error: "None of the requested files belong to you", refused },
              { status: 403 },
            );
          }

          return Response.json({ success: true, count: deleted, refused });
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 500 });
        }
      },
    },
  },
});
