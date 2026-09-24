import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
  FileText,
  MagnifyingGlass as Search,
  ArrowSquareOut as ExternalLink,
  PencilSimple,
  Trash as Trash2,
  Plus,
  X as CloseIcon,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import type { Post } from "#/database/schema";

interface PostsTabProps {
  allPosts: Post[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: "all" | "published" | "draft";
  setStatusFilter: (s: "all" | "published" | "draft") => void;
  filteredPosts: Post[];
  handleDeletePost: (id: number) => void;
}

export function PostsTab({
  allPosts,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  filteredPosts,
  handleDeletePost,
}: PostsTabProps) {
  const publishedCount = allPosts.filter((p) => p.status !== "draft").length;
  const draftCount = allPosts.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 sm:p-4 rounded-2xl ring-1 ring-foreground/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by title, tags, or slug..."
              className="pl-9 pr-8 h-8.5 text-xs rounded-full bg-muted/40 border-border/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <CloseIcon className="size-3" />
              </button>
            )}
          </div>

          <div className="flex items-center self-start sm:self-auto bg-muted/60 p-0.5 rounded-full border border-border/60">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`text-[11px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                statusFilter === "all"
                  ? "bg-background text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({allPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("published")}
              className={`text-[11px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                statusFilter === "published"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Published ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`text-[11px] px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                statusFilter === "draft"
                  ? "bg-background text-amber-600 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Drafts ({draftCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums">
          <span>
            {filteredPosts.length} {filteredPosts.length === 1 ? "article" : "articles"}
          </span>
        </div>
      </div>

      {/* Articles List Surface */}
      <div className="bg-card rounded-2xl ring-1 ring-foreground/10 overflow-hidden">
        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <FileText className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No articles found</p>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search query or filter."
                  : "Start sharing your thoughts by writing your first article."}
              </p>
            </div>
            <div className="pt-1">
              <Button
                render={
                  <Link to="/blog/new">
                    <Plus className="size-3.5 mr-1" />
                    <span>Create New Article</span>
                  </Link>
                }
                size="sm"
                className="rounded-full px-4 h-8 text-xs cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredPosts.map((post) => {
              const tagList = (post.tags || "General")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              const formattedDate = dayjs(post.createdAt).format("MMM D, YYYY");

              return (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground truncate hover:text-primary transition-colors">
                        <Link to="/blog/$slug" params={{ slug: post.slug }}>
                          {post.title}
                        </Link>
                      </h3>
                      {post.status === "draft" ? (
                        <Badge
                          variant="outline"
                          className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-mono text-[10px]"
                        >
                          Draft
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px]"
                        >
                          Published
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                      <span>{formattedDate}</span>
                      <span>•</span>
                      <span className="text-muted-foreground/80">/{post.slug}</span>
                      {tagList.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            {tagList.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="bg-muted px-2 py-0.5 rounded-full text-[10px] border border-border/50 font-mono"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <Button
                      render={
                        <Link to="/blog/$slug" params={{ slug: post.slug }}>
                          <span>View</span>
                          <ExternalLink className="size-3 ml-1" />
                        </Link>
                      }
                      size="xs"
                      variant="outline"
                      className="h-7.5 px-3 rounded-full text-xs cursor-pointer"
                    />

                    <Button
                      render={
                        <Link to="/blog/$slug/edit" params={{ slug: post.slug }}>
                          <PencilSimple className="size-3 mr-1" />
                          <span>Edit</span>
                        </Link>
                      }
                      size="xs"
                      variant="outline"
                      className="h-7.5 px-3 rounded-full text-xs cursor-pointer"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDeletePost(post.id)}
                      className="size-7.5 rounded-full p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      title="Delete article"
                      aria-label="Delete article"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
