import { useState } from "react";
import { BookmarkSimple as Bookmark } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { useModal } from "#/components/providers/modal-providers";
import { useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "#/database/index";
import { bookmarks } from "#/database/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "#/modules/auth/auth.server";

export const toggleBookmarkServerFn = createServerFn({ method: "POST" })
  .validator((postId: number) => postId)
  .handler(async ({ data: postId }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const existing = await db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.userId, session.user.id), eq(bookmarks.postId, postId)),
    });

    if (existing) {
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.postId, postId)));
      return { bookmarked: false };
    } else {
      await db.insert(bookmarks).values({
        userId: session.user.id,
        postId,
      });
      return { bookmarked: true };
    }
  });

interface BookmarkButtonProps {
  postId: number;
  initialBookmarked?: boolean;
  isAuthenticated?: boolean;
}

export function BookmarkButton({
  postId,
  initialBookmarked = false,
  isAuthenticated = false,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const { openLogin } = useModal();
  const router = useRouter();

  const handleToggle = async () => {
    if (!isAuthenticated) {
      openLogin({
        title: "Sign In to Bookmark",
        description: "Save your favorite articles to read anytime by logging in with your email.",
        onSuccess: () => {
          void handleToggle();
        },
      });
      return;
    }

    setLoading(true);
    try {
      const res = await toggleBookmarkServerFn({ data: postId });
      setBookmarked(res.bookmarked);
      router.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={bookmarked ? "default" : "outline"}
      size="sm"
      disabled={loading}
      onClick={handleToggle}
      className="gap-1.5 text-xs"
    >
      {bookmarked ? (
        <>
          <Bookmark className="size-3.5 text-primary-foreground" weight="fill" />
          <span>Saved</span>
        </>
      ) : (
        <>
          <Bookmark className="size-3.5 text-muted-foreground" />
          <span>Bookmark</span>
        </>
      )}
    </Button>
  );
}
