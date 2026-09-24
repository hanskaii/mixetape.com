import { createFileRoute, Link, redirect, useRouter, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  SpinnerGap as Loader2,
  PencilSimple as PenSquare,
  CaretDown as ChevronDown,
  SlidersHorizontal,
  Tag,
  LinkSimple as Link2,
  FileText,
  User,
  X,
} from "@phosphor-icons/react";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { eq } from "drizzle-orm";
import { auth } from "#/modules/auth/auth.server";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { BlogEditor, BlogEditorSkeleton } from "./-components/editor";
import { siteConfig } from "#/config/site";

export const getEditPostPageData = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (!session?.user) throw new Error("Unauthorized");

    const targetPost = await db.query.posts.findFirst({
      where: eq(posts.slug, slug),
    });

    if (!targetPost) return null;

    if (targetPost.userId !== session.user.id) {
      throw new Error("Forbidden: You do not have permission to edit this article.");
    }

    return {
      post: targetPost,
      user: session.user,
    };
  });

export const updateBlogPost = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: number;
      title: string;
      slug: string;
      author?: string;
      authorUsername?: string;
      excerpt?: string;
      tags?: string;
      content: string;
      status?: "draft" | "published";
    }) => data,
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in to edit articles.");
    }

    const targetPost = await db.query.posts.findFirst({
      where: eq(posts.id, data.id),
    });

    if (!targetPost) {
      throw new Error("Article not found");
    }

    // Ownership only: `author` / `authorUsername` are user-controlled display
    // strings defaulting to a fallback, so matching on them let anyone who set
    // that display name edit other people's articles.
    if (targetPost.userId !== session.user.id) {
      throw new Error("Forbidden: You do not have permission to edit this article.");
    }

    const cleanSlug = data.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const updateFields: Partial<typeof posts.$inferInsert> = {
      title: data.title,
      slug: cleanSlug,
      excerpt:
        data.excerpt ||
        data.content
          .replace(/<[^>]+>/g, " ")
          .slice(0, 150)
          .trim(),
      tags: data.tags || "General",
      content: data.content,
      status: data.status || "published",
      updatedAt: new Date(),
    };

    if (data.author) {
      updateFields.author = data.author.trim();
    }
    if (data.authorUsername) {
      updateFields.authorUsername = data.authorUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    }

    await db.update(posts).set(updateFields).where(eq(posts.id, data.id));

    return { success: true, slug: cleanSlug };
  });

export function EditArticleSkeleton() {
  return (
    <main className="min-h-screen pb-24 animate-pulse">
      <div className="border-b border-border/40 px-4 sm:px-8 h-14 flex items-center justify-between">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 space-y-6">
        <Skeleton className="h-10 w-3/4 rounded-md" />
        <div className="border-t border-b border-border/40 py-3 space-y-2">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
        <BlogEditorSkeleton />
      </div>
    </main>
  );
}

export const Route = createFileRoute("/(public)/blog/$slug_/edit")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) {
      throw redirect({
        to: "/blog",
      });
    }
  },
  loader: async ({ params }) => {
    const data = await getEditPostPageData({ data: params.slug });
    if (!data) {
      throw notFound();
    }
    return data;
  },
  pendingComponent: EditArticleSkeleton,
  head: ({ loaderData }) => ({
    meta: [
      { title: `Edit: ${loaderData?.post?.title || "Article"} | ${siteConfig.name}` },
      {
        name: "description",
        content: "Edit article content and properties.",
      },
    ],
  }),
  component: EditArticlePage,
});

function EditArticlePage() {
  const router = useRouter();
  const { post } = Route.useLoaderData();

  const [title, setTitle] = useState(post.title || "");
  const [slug, setSlug] = useState(post.slug || "");
  const [authorName, setAuthorName] = useState(post.author || "");
  const initialTags = (post.tags || "General")
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean);
  const [tagList, setTagList] = useState<string[]>(initialTags);
  const [newTagInput, setNewTagInput] = useState("");
  const [excerpt, setExcerpt] = useState(post.excerpt || "");
  const [content, setContent] = useState(post.content || "");
  const [showProperties, setShowProperties] = useState(false);
  const [status, setStatus] = useState<"draft" | "published">(
    (post.status as "draft" | "published") || "published",
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = useCallback(
    async (e?: React.FormEvent, explicitStatus?: "draft" | "published") => {
      if (e) e.preventDefault();
      if (!title.trim()) {
        setErrorMsg("Please enter an article title.");
        return;
      }
      const finalSlug =
        slug.trim() ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");

      const targetStatus = explicitStatus || status;
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await updateBlogPost({
          data: {
            id: post.id,
            title,
            slug: finalSlug,
            author: authorName.trim() || undefined,
            tags: tagList.length > 0 ? tagList.join(", ") : "General",
            excerpt,
            content: content || "<p></p>",
            status: targetStatus,
          },
        });
        if (res.success) {
          if (targetStatus === "draft") {
            router.navigate({
              to: "/dashboard",
              search: { tab: "posts" },
            });
          } else {
            router.navigate({
              to: "/blog/$slug",
              params: { slug: res.slug },
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update article";
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    },
    [title, slug, status, post.id, authorName, tagList, excerpt, content, router],
  );

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave(undefined, status);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, status]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
  };

  const handleAddTag = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && "key" in e && e.key !== "Enter" && e.key !== ",") return;
    if (e && "preventDefault" in e) e.preventDefault();

    const trimmed = newTagInput.trim().replace(/^#/, "");
    if (trimmed && !tagList.includes(trimmed)) {
      setTagList([...tagList, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagList(tagList.filter((t) => t !== tagToRemove));
  };

  return (
    <main className="min-h-screen pb-24">
      {/* Zenblog Floating Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/60 px-4 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            render={
              <Link to="/blog/$slug" params={{ slug: post.slug }}>
                <ArrowLeft className="size-4 mr-1" />
                <span>Back</span>
              </Link>
            }
            variant="ghost"
            size="xs"
            className="h-8 px-3 rounded-full text-muted-foreground hover:text-foreground"
          />
        </div>

        {/* Save Action Button */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={loading || !title.trim()}
            onClick={() => handleSave(undefined, "draft")}
            className="h-8 px-3 text-xs font-medium rounded-full cursor-pointer"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : "Save as Draft"}
          </Button>

          <Button
            type="button"
            size="xs"
            disabled={loading || !title.trim()}
            onClick={() => handleSave(undefined, "published")}
            className="h-8 px-4 text-xs font-semibold gap-1.5 rounded-full cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <PenSquare className="size-3.5" />
                <span>Update Post</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Canvas */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 text-destructive text-xs ring-1 ring-destructive/20">
            {errorMsg}
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-2">
          <textarea
            rows={1}
            required
            id="edit-article-title"
            aria-label="Article title"
            placeholder="Title"
            value={title}
            onChange={(e) => {
              handleTitleChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className="w-full resize-none bg-transparent text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground placeholder:text-muted-foreground/35 focus:outline-none leading-tight border-none p-0 overflow-hidden"
          />
        </div>

        {/* Document Properties */}
        <div className="border-t border-b border-border/40 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowProperties(!showProperties)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <span>Properties</span>
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${
                  showProperties ? "rotate-180" : ""
                }`}
              />
            </button>

            <span className="text-[11px] font-mono text-muted-foreground">
              {tagList.length} tag{tagList.length !== 1 ? "s" : ""}
            </span>
          </div>

          {showProperties && (
            <div className="space-y-3 pt-1 text-xs">
              {/* Status Selector Property */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-24 text-muted-foreground shrink-0 font-medium text-[11px]">
                  <span>Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("published")}
                    className={`text-[11px] px-3 py-1 rounded-full border font-mono transition-colors cursor-pointer ${
                      status === "published"
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "bg-muted/40 text-muted-foreground border-border/70 hover:text-foreground"
                    }`}
                  >
                    • Published
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("draft")}
                    className={`text-[11px] px-3 py-1 rounded-full border font-mono transition-colors cursor-pointer ${
                      status === "draft"
                        ? "bg-foreground/15 text-foreground border-foreground/30 font-semibold"
                        : "bg-muted/40 text-muted-foreground border-border/70 hover:text-foreground"
                    }`}
                  >
                    • Draft
                  </button>
                </div>
              </div>

              {/* Author Attribution Property */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="edit-article-author"
                  className="flex items-center gap-1.5 w-24 text-muted-foreground shrink-0 font-medium text-[11px]"
                >
                  <User className="size-3.5" />
                  <span>Author</span>
                </label>
                <div className="flex-1 flex items-center bg-muted/40 rounded-full px-3 py-1 border border-border/70">
                  <input
                    id="edit-article-author"
                    aria-label="Author display name"
                    type="text"
                    placeholder="Author display name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground ml-2">
                    (@{post.authorUsername || "author"})
                  </span>
                </div>
              </div>

              {/* Slug Property */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="edit-article-slug"
                  className="flex items-center gap-1.5 w-24 text-muted-foreground shrink-0 font-medium text-[11px]"
                >
                  <Link2 className="size-3.5" />
                  <span>Slug</span>
                </label>
                <div className="flex-1 flex items-center bg-muted/40 rounded-full px-3 py-1 border border-border/70">
                  <span className="text-muted-foreground font-mono text-[11px] mr-1">/blog/</span>
                  <input
                    id="edit-article-slug"
                    aria-label="URL slug"
                    type="text"
                    placeholder="my-post-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              {/* Tags UI Component Property */}
              <div className="flex items-start gap-3">
                <label
                  htmlFor="edit-article-tags"
                  className="flex items-center gap-1.5 w-24 text-muted-foreground shrink-0 font-medium text-[11px] pt-1.5"
                >
                  <Tag className="size-3.5" />
                  <span>Tags</span>
                </label>
                <div className="flex-1 flex flex-wrap items-center gap-1.5 p-2 bg-muted/40 rounded-2xl border border-border/70 min-h-[38px]">
                  {tagList.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 bg-background text-foreground ring-1 ring-foreground/10 px-2.5 py-0.5 rounded-full text-[11px] font-mono"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Remove tag"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="edit-article-tags"
                    aria-label="Add tag"
                    type="text"
                    placeholder="+ Add tag (Enter)"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground font-mono focus:outline-none px-2 py-0.5 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              {/* Excerpt / Summary Property */}
              <div className="flex items-start gap-3">
                <label
                  htmlFor="edit-article-excerpt"
                  className="flex items-center gap-1.5 w-24 text-muted-foreground shrink-0 font-medium text-[11px] pt-1.5"
                >
                  <FileText className="size-3.5" />
                  <span>Excerpt</span>
                </label>
                <div className="flex-1 bg-muted/40 rounded-2xl px-3 py-2 border border-border/70">
                  <textarea
                    id="edit-article-excerpt"
                    aria-label="Article summary excerpt"
                    rows={2}
                    placeholder="Short 1-paragraph summary for preview cards..."
                    value={excerpt}
                    onChange={(e) => {
                      setExcerpt(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    className="w-full bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed overflow-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rich Text Writing Canvas */}
        <div className="space-y-3">
          <BlogEditor
            content={content}
            onChange={setContent}
            onAiTitleGenerated={(suggestedTitle) => {
              handleTitleChange(suggestedTitle);
            }}
            onAiSummaryGenerated={(suggestedExcerpt) => {
              setExcerpt(suggestedExcerpt);
            }}
            placeholder="Tell your story, explain architecture, or share code..."
          />
        </div>
      </div>
    </main>
  );
}
