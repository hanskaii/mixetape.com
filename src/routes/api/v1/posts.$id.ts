import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import { cancelPost, getPost, retryPost } from "#/modules/social/social.service";

// GET    /api/v1/posts/:id        — one post and its status
// DELETE /api/v1/posts/:id        — cancel a post that is still scheduled
// POST   /api/v1/posts/:id?retry  — send a failed post again
export const Route = createFileRoute("/api/v1/posts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        respond(async () => ({ post: await getPost(await requireUser(request), params.id) })),

      DELETE: async ({ request, params }) =>
        respond(async () => ({ post: await cancelPost(await requireUser(request), params.id) })),

      POST: async ({ request, params }) =>
        respond(async () => ({ post: await retryPost(await requireUser(request), params.id) })),
    },
  },
});
