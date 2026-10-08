import { env } from "cloudflare:workers";
import { siteConfig } from "#/config/site";

/**
 * Sends one plain email through Cloudflare Email Service (the EMAIL binding). Account
 * notices only: short text, one link, sent from no-reply. Without the binding (local dev)
 * the email is printed instead. Returns whether it was handed over.
 */
export async function sendEmail(message: {
  to: string;
  subject: string;
  /** Paragraphs, the first being the greeting line. */
  paragraphs: string[];
  link?: { label: string; url: string };
  /** Where a reply goes, when it is not no-reply (feedback: the person who wrote it). */
  replyTo?: string;
}) {
  const text = [
    ...message.paragraphs,
    message.link ? `${message.link.label}: ${message.link.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!env.EMAIL || typeof env.EMAIL.send !== "function") {
    console.log(
      `[email] (not sent, no EMAIL binding) to ${message.to}: ${message.subject}\n${text}`,
    );
    return false;
  }
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;line-height:1.55">
${message.paragraphs.map((p) => `<p>${escape(p)}</p>`).join("\n")}
${
  message.link
    ? `<p><a href="${message.link.url}" style="display:inline-block;background:#ffd337;color:#111;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">${escape(message.link.label)}</a></p>`
    : ""
}
<p style="color:#666;font-size:12px">${escape(siteConfig.name)} · ${siteConfig.url.replace(/^https?:\/\//, "")}</p>
</div>`;
  try {
    await env.EMAIL.send({
      from: env.EMAIL_FROM || `no-reply@${siteConfig.url.replace(/^https?:\/\//, "")}`,
      to: message.to,
      ...(message.replyTo && { replyTo: message.replyTo }),
      subject: message.subject,
      html,
      text,
    });
    return true;
  } catch (error) {
    console.error(`[email] could not send "${message.subject}" to ${message.to}:`, error);
    return false;
  }
}
