import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(public)/privacy")({
  head: () => ({ meta: [{ title: `Privacy | ${siteConfig.name}` }] }),
  component: Privacy,
});

/**
 * The privacy policy every OAuth app (Google, Meta, TikTok, Pinterest) requires a public
 * URL for. Written from what the schema and services actually store and do — see
 * src/database/schema.ts and src/modules/*.
 */
function Privacy() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-10 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated September 27, 2026</p>
      </div>

      <section className="space-y-2">
        <p>
          {siteConfig.name} is a scheduling tool that publishes video posts to social media channels
          on behalf of the person or organization who connects them. It is operated as a single-user
          tool by its developer; it is not offered as a public service, and it does not sell or
          share data with third parties for advertising.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What we store</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">Account:</strong> your name, email address and, if
            you sign in with Google or GitHub, the profile image and account ID those providers give
            us.
          </li>
          <li>
            <strong className="text-foreground">Channel access:</strong> for each channel you
            connect (a YouTube channel, Facebook Page, Instagram account, Threads profile, TikTok
            account or Pinterest account), the access and refresh tokens that platform issues,
            stored encrypted (AES-GCM), plus its name, handle and public avatar. We never see your
            platform account password.
          </li>
          <li>
            <strong className="text-foreground">Posts:</strong> the media, caption and metadata you
            or your agent schedule, when it is due, and what the platform reports back (published,
            failed, view counts) once it is live.
          </li>
          <li>
            <strong className="text-foreground">Uploaded media:</strong> video and image files you
            upload are stored in our bucket for as long as a scheduled post needs them.
          </li>
          <li>
            <strong className="text-foreground">API keys:</strong> we store a one-way hash of each
            key you create for an agent or script; the key itself is shown once and never stored in
            reversible form.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What we do with it</h2>
        <p>
          We use platform access tokens only to publish the posts you or your connected agents
          schedule, read their status and (where you ask) their comments and analytics, all through
          the platform's own API. We do not read, post or act on your accounts outside what you
          explicitly schedule. We do not use your data to train any model.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Sharing</h2>
        <p>
          Your posts and their metadata are sent to the social platforms you connect, because that
          is the point of the service. We do not share your data with any other third party. Our
          infrastructure providers (hosting, storage, database) process data on our behalf under
          their own security commitments; they do not use it for their own purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Retention and deletion</h2>
        <p>
          Data is kept for as long as your account is active. Disconnecting a channel removes its
          stored tokens. Deleting a post removes it from the queue (posts already published stay on
          the platform itself, governed by that platform's own policies). To close your account and
          have your data deleted, contact us at the email below.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Contact</h2>
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:hanssn@mixetape.com" className="text-foreground underline">
            hanssn@mixetape.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
