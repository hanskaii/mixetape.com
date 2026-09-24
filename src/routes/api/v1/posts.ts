import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import {
  ServiceError,
  createPost,
  listPosts,
  type CreatePostInput,
} from "#/modules/social/social.service";

// GET  /api/v1/posts?status=scheduled,failed&from=ISO&to=ISO&limit=50
// POST /api/v1/posts { accountId, mediaUrl, caption?, scheduledAt?, metadata? }
//
// For YouTube, metadata is { title, description?, category?, tags?, privacyStatus?,
// madeForKids?, notifySubscribers? }. A post more than 15 minutes ahead is uploaded at once
// and published by YouTube at scheduledAt.
export const Route = createFileRoute("/api/v1/posts")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const params = new URL(request.url).searchParams;
          const date = (name: string) => {
            const value = params.get(name);
            return value ? new Date(value) : undefined;
          };
          const posts = await listPosts(userId, {
            status: params.get("status")?.split(",").filter(Boolean),
            from: date("from"),
            to: date("to"),
            limit: Number(params.get("limit") ?? 100),
          });
          return { posts };
        }),

      POST: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const body = (await request.json().catch(() => null)) as CreatePostInput | null;
          if (!body?.accountId || !body.mediaUrl)
            throw new ServiceError("accountId and mediaUrl are required");
          return { post: await createPost(userId, body) };
        }, 201),
    },
  },
});
