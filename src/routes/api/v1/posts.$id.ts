import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import {
  cancelPost,
  editPost,
  getPost,
  postInsights,
  retryPost,
  setPostThumbnail,
  type EditPostInput,
} from "#/modules/social/social.service";

// GET    /api/v1/posts/:id             — one post and its status
// GET    /api/v1/posts/:id?insights=1  — plus live platform status and metrics
// PATCH  /api/v1/posts/:id             — change a scheduled post { scheduledAt?, mediaUrl?, caption?, metadata? }
// DELETE /api/v1/posts/:id             — cancel a post that is still scheduled
// POST   /api/v1/posts/:id             — send a failed post again
// POST   /api/v1/posts/:id { thumbnailUrl } — set/replace the thumbnail of a post already on the platform
export const Route = createFileRoute("/api/v1/posts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        respond(async () => {
          const userId = await requireUser(request);
          if (new URL(request.url).searchParams.has("insights"))
            return postInsights(userId, params.id);
          return { post: await getPost(userId, params.id) };
        }),

      PATCH: async ({ request, params }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const changes = ((await request.json().catch(() => null)) ?? {}) as EditPostInput;
          return { post: await editPost(userId, params.id, changes) };
        }),

      DELETE: async ({ request, params }) =>
        respond(async () => ({ post: await cancelPost(await requireUser(request), params.id) })),

      POST: async ({ request, params }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const body = ((await request.json().catch(() => null)) ?? {}) as {
            thumbnailUrl?: string;
          };
          if (body.thumbnailUrl)
            return { post: await setPostThumbnail(userId, params.id, body.thumbnailUrl) };
          return { post: await retryPost(userId, params.id) };
        }),
    },
  },
});
