import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useState, useMemo } from "react";
import dayjs from "dayjs";
import { z } from "zod";
import { MagnifyingGlass as Search, X, PencilSimple as PenSquare } from "@phosphor-icons/react";
import { db } from "#/database/index";
import { posts, bookmarks } from "#/database/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "#/modules/auth/auth.server";
import { Route as RootRoute } from "#/routes/__root";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";

const blogSearchSchema = z.object({
  tag: z.string().optional(),
});

export const getBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  let userBookmarks: number[] = [];

  if (headers) {
    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (session?.user) {
      const bMarks = await db.query.bookmarks.findMany({
        where: eq(bookmarks.userId, session.user.id),
      });
      userBookmarks = bMarks.map((b) => b.postId);
    }
  }

  const postsList = await db.query.posts.findMany({
    where: eq(posts.status, "published"),
    orderBy: [desc(posts.createdAt)],
    limit: 50,
  });

  return {
    posts: postsList,
    userBookmarks,
  };
});

export const Route = createFileRoute("/(public)/blog/")({
  validateSearch: (search: Record<string, unknown>) => blogSearchSchema.parse(search),
  loader: async () => await getBlogPosts(),
  head: () => ({
    meta: [
      { title: `Blog & Articles | ${siteConfig.name}` },
      {
        name: "description",
        content: `Articles, engineering guides, and deep-dives from ${siteConfig.name}.`,
      },
      { property: "og:title", content: `Blog & Articles | ${siteConfig.name}` },
      {
        property: "og:description",
        content: `Articles, engineering guides, and deep-dives from ${siteConfig.name}.`,
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: `/api/og?title=${encodeURIComponent("Blog & Articles Hub")}&tags=Blog,Architecture&author=${encodeURIComponent(siteConfig.author.name)}`,
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: `/api/og?title=${encodeURIComponent("Blog & Articles Hub")}&tags=Blog,Architecture&author=${encodeURIComponent(siteConfig.author.name)}`,
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts: postsList } = Route.useLoaderData();
  const { tag: selectedTag } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;

  const [searchQuery, setSearchQuery] = useState("");

  const handleTagClick = (tag: string | undefined) => {
    navigate({
      search: (prev) => ({
        ...prev,
        tag: prev.tag === tag ? undefined : tag,
      }),
    });
  };

  // Filter posts by tag from URL query param & search query
  const filteredPosts = useMemo(() => {
    const lowerSelectedTag = selectedTag?.toLowerCase();
    const lowerSearchQuery = searchQuery.trim().toLowerCase();

    return postsList.filter((p) => {
      const matchesTag = lowerSelectedTag
        ? new Set((p.tags || "").split(",").map((t) => t.trim().toLowerCase())).has(
            lowerSelectedTag,
          )
        : true;

      const matchesSearch = lowerSearchQuery
        ? p.title.toLowerCase().includes(lowerSearchQuery) ||
          (p.excerpt && p.excerpt.toLowerCase().includes(lowerSearchQuery)) ||
          (p.tags && p.tags.toLowerCase().includes(lowerSearchQuery)) ||
          (p.author && p.author.toLowerCase().includes(lowerSearchQuery))
        : true;

      return matchesTag && matchesSearch;
    });
  }, [postsList, selectedTag, searchQuery]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    return Array.from(
      new Set(
        postsList.flatMap((p) =>
          (p.tags || "General")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ),
    );
  }, [postsList]);

  return (
    <main className="space-y-6 px-4 py-8 md:py-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              Editorial &amp; Essays
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Blog &amp; Articles
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Thoughts, architecture deep dives, and practical notes on building fast, resilient
            systems.
          </p>
        </div>

        {user ? (
          <Button
            render={
              <Link to="/blog/new">
                <PenSquare className="size-3.5" />
                <span>Write Post</span>
              </Link>
            }
            size="sm"
            className="gap-1.5 rounded-full px-4 h-8 text-xs cursor-pointer"
          />
        ) : (
          <Button
            render={<Link to="/settings/profile">Sign In to Write &rarr;</Link>}
            size="sm"
            variant="outline"
            className="rounded-full px-4 h-8 text-xs font-medium"
          />
        )}
      </div>

      {/* Instant Search and Tag Filters Bar */}
      <div className="space-y-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            aria-label="Search articles by title, tags, or author"
            placeholder="Search articles by title, tags, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/40 border border-border/70 rounded-full pl-9 pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Shareable Filter by Tags (via Query Params) */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleTagClick(undefined)}
              className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                !selectedTag
                  ? "bg-primary text-primary-foreground font-medium border-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/70"
              }`}
            >
              All ({postsList.length})
            </button>
            {allTags.map((t) => {
              const isMatch = selectedTag?.toLowerCase() === t.toLowerCase();
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTagClick(t)}
                  className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                    isMatch
                      ? "bg-primary text-primary-foreground font-medium border-primary"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/70"
                  }`}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Post Listing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Articles ({filteredPosts.length}) {selectedTag ? `• Filtered by #${selectedTag}` : ""}
          </h2>
          {(selectedTag || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                handleTagClick(undefined);
                setSearchQuery("");
              }}
              className="text-xs text-primary hover:underline cursor-pointer font-medium"
            >
              Reset filters
            </button>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl ring-1 ring-foreground/10 bg-card border-dashed text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">No matching articles found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search query or tag filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPosts.map((post) => {
              const tagList = (post.tags || "General")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              const formattedDate = dayjs(post.createdAt).format("MMM D, YYYY");
              const ogThumb = `/api/og?title=${encodeURIComponent(
                post.title,
              )}&tags=${encodeURIComponent(tagList.join(","))}&author=${encodeURIComponent(
                post.author,
              )}&date=${encodeURIComponent(formattedDate)}`;

              return (
                <article
                  key={post.id}
                  className="rounded-2xl ring-1 ring-foreground/10 bg-card overflow-hidden flex flex-col justify-between group hover:ring-foreground/25 transition-[box-shadow,ring-color] duration-200"
                >
                  {/* Dynamic Thumbnail */}
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="block overflow-hidden aspect-[1200/630] border-b border-border/80 bg-muted/40 relative"
                  >
                    <img
                      src={ogThumb}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </Link>

                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{formattedDate}</span>
                        </div>
                        <span className="text-foreground/80 truncate max-w-[120px]">
                          @{post.authorUsername || post.author}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                        <Link to="/blog/$slug" params={{ slug: post.slug }}>
                          {post.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.excerpt ||
                          post.content.replace(/<[^>]+>/g, " ").slice(0, 120) + "..."}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-1 text-xs">
                      {/* Tags */}
                      <div className="flex items-center gap-1 flex-wrap overflow-hidden">
                        {tagList.slice(0, 2).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleTagClick(t);
                            }}
                            className="bg-muted/60 px-2 py-0.5 rounded-full text-[11px] text-muted-foreground font-mono hover:text-foreground ring-1 ring-foreground/10 cursor-pointer"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>

                      <Button
                        render={
                          <Link to="/blog/$slug" params={{ slug: post.slug }}>
                            Read &rarr;
                          </Link>
                        }
                        size="xs"
                        variant="ghost"
                        className="rounded-full text-xs"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
