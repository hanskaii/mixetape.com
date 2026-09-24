import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { requireUser, respond } from "#/modules/social/http";
import { ServiceError } from "#/modules/social/social.service";

/**
 * Video uploads, any size, straight into R2.
 *
 * A request body is capped at 100 MB and a Worker should never hold a whole video in
 * memory, so the browser sends the file in parts and each part is streamed into an R2
 * multipart upload:
 *
 *   POST /api/media/upload?action=create   { name, type }       → { key, uploadId }
 *   PUT  /api/media/upload?action=part&key&uploadId&part=N  (raw bytes, ≥ 5 MB except the last)
 *   POST /api/media/upload?action=complete { key, uploadId, parts } → { key, url: "r2://…" }
 *   POST /api/media/upload?action=abort    { key, uploadId }
 *
 * Keys live under media/<userId>/, which is how a post proves the file is the caller's.
 */

type PartRef = { partNumber: number; etag: string };

function ownKey(userId: string, key: string | null): string {
  if (!key || !key.startsWith(`media/${userId}/`)) throw new ServiceError("Not your upload", 403);
  return key;
}

export const Route = createFileRoute("/api/media/upload")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const action = new URL(request.url).searchParams.get("action");
          const body = (await request.json().catch(() => ({}))) as {
            name?: string;
            type?: string;
            key?: string;
            uploadId?: string;
            parts?: PartRef[];
          };

          if (action === "create") {
            const name = (body.name ?? "video.mp4").replace(/[^a-zA-Z0-9.-]/g, "_").slice(-120);
            const key = `media/${userId}/${Date.now()}-${name}`;
            const upload = await env.BUCKET.createMultipartUpload(key, {
              httpMetadata: { contentType: body.type || "video/mp4" },
              customMetadata: { userId, originalName: body.name ?? name },
            });
            return { key, uploadId: upload.uploadId };
          }

          const key = ownKey(userId, body.key ?? null);
          if (!body.uploadId) throw new ServiceError("uploadId is required");
          const upload = env.BUCKET.resumeMultipartUpload(key, body.uploadId);

          if (action === "complete") {
            if (!body.parts?.length) throw new ServiceError("parts are required");
            const object = await upload.complete(body.parts);
            return { key, size: object.size, url: `r2://${key}` };
          }
          if (action === "abort") {
            await upload.abort();
            return { aborted: true };
          }
          throw new ServiceError("Unknown action");
        }),

      PUT: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const params = new URL(request.url).searchParams;
          const key = ownKey(userId, params.get("key"));
          const uploadId = params.get("uploadId");
          const partNumber = Number(params.get("part"));
          if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
            throw new ServiceError("uploadId and part are required");
          }
          if (!request.body) throw new ServiceError("Empty part");
          const part = await env.BUCKET.resumeMultipartUpload(key, uploadId).uploadPart(
            partNumber,
            request.body,
          );
          return { partNumber: part.partNumber, etag: part.etag };
        }),
    },
  },
});
