import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { auth } from "#/modules/auth/auth.server";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { findUnknownMathTags, repairMathEmphasis } from "#/modules/posts/markdown";

/**
 * Deliberately unwired: rewriting stored article content is an operator
 * decision, not a button. Run it dry (the default), read the returned slugs,
 * then run it again with `apply: true`.
 */
const MAX_POSTS_PER_RUN = 50;

export const repairMathPosts = createServerFn({ method: "POST" })
  .validator((data: { apply?: boolean }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("Unauthorized");

    const apply = data.apply === true;

    const owned = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, session.user.id))
      .limit(MAX_POSTS_PER_RUN + 1);

    const truncated = owned.length > MAX_POSTS_PER_RUN;
    const batch = owned.slice(0, MAX_POSTS_PER_RUN);

    const slugs: string[] = [];
    const unknownTags: { slug: string; tags: string[] }[] = [];
    let changed = 0;

    for (const post of batch) {
      const repaired = repairMathEmphasis(post.content);
      if (repaired === post.content) continue;

      slugs.push(post.slug);

      const tags = findUnknownMathTags(post.content);
      if (tags.length) unknownTags.push({ slug: post.slug, tags });

      if (apply) {
        await db.update(posts).set({ content: repaired }).where(eq(posts.id, post.id));
        changed += 1;
      }
    }

    return {
      scanned: batch.length,
      wouldChange: slugs.length,
      changed,
      truncated,
      slugs,
      unknownTags,
    };
  });
