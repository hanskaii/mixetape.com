import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { createPost, listPosts, getPostBySlug } from "#/modules/posts/posts.service";
import { siteConfig } from "#/config/site";

/** Length-independent comparison so a wrong token leaks no timing signal. */
function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * MCP consumers are machines with no session cookie, so this surface is gated by
 * a shared bearer token. Returns a Response to send when the caller is not
 * authorized, or null when it is.
 *
 * Fails closed: an unset MCP_API_KEY rejects every request rather than allowing
 * them, which is how this endpoint came to be open in the first place.
 */
function rejectUnauthorized(request: Request): Response | null {
  const expected = env.MCP_API_KEY;
  if (!expected) {
    return Response.json({ error: "MCP endpoint is not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tokensMatch(header.slice("Bearer ".length).trim(), expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export const Route = createFileRoute("/api/posts/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = rejectUnauthorized(request);
        if (unauthorized) return unauthorized;

        // SSE MCP protocol discovery & tools definition
        const tools = [
          {
            name: "create_post",
            description: `Create and publish or draft a new blog post on ${siteConfig.name} blog`,
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Title of the blog post",
                },
                content: {
                  type: "string",
                  description: "Body content in Markdown or HTML (supports $$ LaTeX math $$)",
                },
                slug: {
                  type: "string",
                  description: "Custom URL slug (optional)",
                },
                excerpt: {
                  type: "string",
                  description: "Short summary excerpt (optional)",
                },
                tags: {
                  type: "string",
                  description: "Comma-separated tags (e.g. 'finance, wealth, systems')",
                },
                status: {
                  type: "string",
                  enum: ["draft", "published"],
                  description: "Publish status ('draft' or 'published')",
                },
                author: {
                  type: "string",
                  description: "Display name of the author",
                },
              },
              required: ["title", "content"],
            },
          },
          {
            name: "list_posts",
            description: "List recent blog posts",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Max number of posts to return",
                },
              },
            },
          },
          {
            name: "get_post",
            description: "Get a specific blog post by slug",
            inputSchema: {
              type: "object",
              properties: {
                slug: {
                  type: "string",
                  description: "Post slug",
                },
              },
              required: ["slug"],
            },
          },
        ];

        return Response.json({
          name: "kit-posts-mcp",
          version: "1.0.0",
          tools,
        });
      },
      POST: async ({ request }) => {
        const unauthorized = rejectUnauthorized(request);
        if (unauthorized) return unauthorized;

        try {
          const body = (await request.json().catch(() => ({}))) as {
            jsonrpc?: string;
            id?: string | number;
            method?: string;
            params?: any;
            action?: string;
            data?: any;
          };

          // Support both standard JSON-RPC MCP and direct HTTP RPC calls
          const method = body.method || body.action;
          const params = body.params || body.data || {};

          if (method === "tools/list" || method === "list_tools") {
            return Response.json({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: {
                tools: [
                  {
                    name: "create_post",
                    description: "Create and publish a blog post in Markdown",
                    inputSchema: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                        slug: { type: "string" },
                        excerpt: { type: "string" },
                        tags: { type: "string" },
                        status: { type: "string", enum: ["draft", "published"] },
                        author: { type: "string" },
                      },
                      required: ["title", "content"],
                    },
                  },
                ],
              },
            });
          }

          if (
            method === "tools/call" ||
            method === "create_post" ||
            params.name === "create_post"
          ) {
            const args = params.arguments || params;
            if (!args.title || !args.content) {
              return Response.json(
                {
                  jsonrpc: "2.0",
                  id: body.id ?? 1,
                  error: { code: -32602, message: "Missing required fields: title, content" },
                },
                { status: 400 },
              );
            }

            const post = await createPost({
              title: args.title,
              content: args.content,
              slug: args.slug,
              excerpt: args.excerpt,
              tags: args.tags,
              status: args.status || "published",
              author: args.author || siteConfig.author.name,
            });

            return Response.json({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        success: true,
                        post: {
                          id: post.id,
                          title: post.title,
                          slug: post.slug,
                          url: `${siteConfig.url}/blog/${post.slug}`,
                          status: post.status,
                        },
                      },
                      null,
                      2,
                    ),
                  },
                ],
              },
            });
          }

          if (method === "list_posts" || params.name === "list_posts") {
            const args = params.arguments || params;
            const items = await listPosts(args.limit || 20);
            return Response.json({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(items, null, 2),
                  },
                ],
              },
            });
          }

          if (method === "get_post" || params.name === "get_post") {
            const args = params.arguments || params;
            const item = await getPostBySlug(args.slug);
            return Response.json({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(item, null, 2),
                  },
                ],
              },
            });
          }

          return Response.json(
            {
              jsonrpc: "2.0",
              id: body.id ?? 1,
              error: { code: -32601, message: `Method not found: ${method}` },
            },
            { status: 404 },
          );
        } catch (err: any) {
          return Response.json(
            {
              jsonrpc: "2.0",
              error: { code: -32603, message: err?.message || "Internal error" },
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
