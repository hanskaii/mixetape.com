import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/api/http";
import { createPost, listPosts, type CreatePostInput } from "#/modules/social/social.service";
import { ServiceError } from "#/modules/api/errors";

// GET  /api/v1/posts?accountId=a,b&provider=youtube&status=scheduled,failed&search=words
//                    &from=ISO&to=ISO&limit=50&cursor=… — { posts, nextCursor }
// POST /api/v1/posts { accountId, mediaUrl | media[], caption?, scheduledAt?, leadMinutes?, metadata? }
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
          const userId = await requireUser(request, "read");
          const params = new URL(request.url).searchParams;
          const date = (name: string) => {
            const value = params.get(name);
            return value ? new Date(value) : undefined;
          };
          const list = (name: string) => params.get(name)?.split(",").filter(Boolean);
          return listPosts(userId, {
            accountId: list("accountId"),
            provider: list("provider"),
            status: list("status"),
            search: params.get("search") ?? undefined,
            from: date("from"),
            to: date("to"),
            limit: Number(params.get("limit") ?? 100),
            cursor: params.get("cursor") ?? undefined,
          });
        }),

      POST: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request, "publish");
          const body = (await request.json().catch(() => null)) as CreatePostInput | null;
          if (!body?.accountId || !(body.mediaUrl || body.media?.length))
            throw new ServiceError("accountId and mediaUrl (or media) are required");
          // itemId is set only by the library's schedule_item, never from outside.
          const { itemId: _itemId, ...input } = body;
          return { post: await createPost(userId, input) };
        }, 201),
    },
  },
});
