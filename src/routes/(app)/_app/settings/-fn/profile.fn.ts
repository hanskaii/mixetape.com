import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/modules/auth/auth.server";
import { db } from "#/database/index";
import { user } from "#/database/schema";
import { eq } from "drizzle-orm";

export interface ProfileData {
  name: string;
  bio: string;
  image: string;
}

export const getProfileData = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  if (!headers) throw new Error("Unauthorized");

  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error("Unauthorized");

  const [currentUser] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);

  if (!currentUser) throw new Error("User not found");

  return {
    user: currentUser,
  };
});

export const updateProfileData = createServerFn({ method: "POST" })
  .validator((data: { name?: string; bio?: string; image?: string }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("Unauthorized");

    const updateData: Partial<typeof user.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof data.name === "string" && data.name.trim()) {
      updateData.name = data.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
    }
    if (typeof data.bio === "string") {
      updateData.bio = data.bio.trim();
    }
    if (typeof data.image === "string") {
      updateData.image = data.image.trim();
    }

    await db.update(user).set(updateData).where(eq(user.id, session.user.id));

    const [updatedUser] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);

    return {
      success: true,
      user: updatedUser,
    };
  });
