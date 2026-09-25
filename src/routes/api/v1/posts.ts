import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import {
  ServiceError,
  createPost,
  listPosts,
  type CreatePostInput,
} from "#/modules/social/social.service";

// GET  /api/v1/posts?status=scheduled,failed&from=ISO&to=ISO&limit=50
// POST /api/v1/posts { accountId, mediaUrl, caption?, scheduledAt?, leadMinutes?, metadata? }
//
// Like Buffer, a post waits in mixetape until leadMinutes before scheduledAt (YouTube default
// 30), then goes up as private and YouTube makes it public at scheduledAt. Omitting
// scheduledAt means "post now": live once the lead has passed. For YouTube, metadata is
// { title, description?, category?, tags?, privacyStatus?, madeForKids?, notifySubscribers? }.
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
