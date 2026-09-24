import { useState, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  BookmarkSimple as Bookmark,
  ArrowSquareOut as ExternalLink,
  Trash as Trash2,
  BookOpen,
} from "@phosphor-icons/react";
import { eq, desc } from "drizzle-orm";
import { db } from "#/database/index";
import { bookmarks, posts } from "#/database/schema";
import { auth } from "#/modules/auth/auth.server";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { toggleBookmarkServerFn } from "./bookmark-button";

export interface BookmarkedPostItem {
  id: number;
  postId: number;
  title: string;
  slug: string;
  author: string;
  tags: string | null;
  createdAt: Date;
}

export const getUserBookmarks = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  if (!headers) return [];

  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return [];

  const userBookmarks = await db
    .select({
      id: bookmarks.id,
      postId: bookmarks.postId,
      title: posts.title,
      slug: posts.slug,
      author: posts.author,
      tags: posts.tags,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .where(eq(bookmarks.userId, session.user.id))
    .orderBy(desc(bookmarks.createdAt));

  return userBookmarks as BookmarkedPostItem[];
});

export function BookmarkHeaderMenu() {
  const [items, setItems] = useState<BookmarkedPostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const data = await getUserBookmarks();
      setItems(data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookmarks();
  }, []);

  const handleRemove = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleBookmarkServerFn({ data: postId });
      setItems((prev) => prev.filter((item) => item.postId !== postId));
      router.invalidate();
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void fetchBookmarks()}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label="Bookmarked Articles"
            className="relative size-8 p-0 rounded-full text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
            title="Bookmarked Articles"
          >
            <Bookmark className="size-4" />
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-mono font-bold text-primary-foreground">
                {items.length > 99 ? "99+" : items.length}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-80 p-2 rounded-2xl ring-1 ring-foreground/10 shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center justify-between text-xs font-semibold px-2 py-1">
          <span className="flex items-center gap-1.5">
            <Bookmark className="size-3.5 text-primary" />
            <span>Saved Articles</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <p>Loading bookmarks...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground space-y-1.5">
            <BookOpen className="size-6 mx-auto opacity-40 text-muted-foreground" />
            <p className="font-medium">No bookmarks yet</p>
            <p className="text-[11px] text-muted-foreground/70">
              Click bookmark on any article to save it here.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-muted/50 transition-colors"
              >
                <Link
                  to="/blog/$slug"
                  params={{ slug: item.slug }}
                  className="flex-1 min-w-0 no-underline"
                >
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                    <span>by {item.author}</span>
                    {item.tags && (
                      <>
                        <span>•</span>
                        <span className="text-primary/70 font-mono">
                          #{item.tags.split(",")[0].trim()}
                        </span>
                      </>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <Button
                    render={
                      <Link to="/blog/$slug" params={{ slug: item.slug }}>
                        <ExternalLink className="size-3" />
                      </Link>
                    }
                    variant="ghost"
                    size="icon"
                    aria-label={`Open ${item.title}`}
                    className="size-6 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Open article"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove bookmark ${item.title}`}
                    onClick={(e) => handleRemove(e, item.postId)}
                    className="size-6 rounded-full text-muted-foreground hover:text-destructive cursor-pointer"
                    title="Remove bookmark"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link to="/blog" className="w-full text-center text-xs text-primary">
              Explore more articles &rarr;
            </Link>
          }
          className="text-center justify-center font-medium cursor-pointer"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
