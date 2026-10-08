import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db } from "#/database";
import { user } from "#/database/schema";
import { siteConfig } from "#/config/site";
import { currentUserId } from "#/modules/auth/auth.server";
import { sendEmail } from "#/modules/email/email.service";

/** Feedback per person per hour; enough to say anything, too few to flood the inbox. */
const PER_HOUR = 5;
const MAX_LENGTH = 5000;

/**
 * Feedback from the workspace, emailed to mixetape's inbox with the writer as reply-to, so
 * answering is one click. Anyone signed in may write, with or without a plan.
 */
export const sendFeedback = createServerFn({ method: "POST" })
  .validator((data: { message: string; page?: string }) => {
    const message = String(data?.message ?? "").trim();
    if (!message) throw new Error("Write something first");
    if (message.length > MAX_LENGTH)
      throw new Error(`Feedback is limited to ${MAX_LENGTH} characters`);
    return { message, page: String(data?.page ?? "").slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const key = `feedback:${userId}:${Math.floor(Date.now() / 3_600_000)}`;
    const sent = Number((await env.KIT_CACHE.get(key)) ?? 0);
    if (sent >= PER_HOUR)
      throw new Error("Thanks — that is plenty for this hour. Try again later.");
    await env.KIT_CACHE.put(key, String(sent + 1), { expirationTtl: 3600 });

    const person = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { email: true, name: true },
    });
    if (!person) throw new Error("Unauthorized");
    const delivered = await sendEmail({
      to: siteConfig.contactEmail,
      replyTo: person.email,
      subject: `Feedback from ${person.name || person.email}`,
      paragraphs: [
        `From ${person.name ? `${person.name} <${person.email}>` : person.email}${data.page ? `, on ${data.page}` : ""}:`,
        ...data.message.split(/\n{2,}/),
      ],
    });
    if (!delivered) throw new Error("Your feedback could not be sent. Please email us instead.");
    return { sent: true };
  });
