import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";
import { publicHead } from "./-lib/head";

export const Route = createFileRoute("/(public)/privacy")({
  head: () =>
    publicHead({
      path: "/privacy",
      title: `Privacy Policy | ${siteConfig.name}`,
      description:
        "What mixetape stores when you connect social channels, how it uses YouTube API Services and platform tokens, and how to revoke access or delete your data.",
    }),
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
        <p className="mt-1 text-xs text-muted-foreground">Last updated October 2, 2026</p>
      </div>

      <section className="space-y-2">
        <p>
          {siteConfig.name} is a scheduling tool that publishes video and image posts to social
          media channels on behalf of the person or organization who connects them. Anyone can sign
          up and connect their own channels; each person can only reach their own. We do not sell or
          share data with third parties for advertising. By signing in you agree to this policy.
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
            account, Pinterest account, Bluesky account or Mastodon account), the access and refresh
            tokens that platform issues, stored encrypted (AES-GCM), plus its name, handle and
            public avatar. We never see your platform account password.
          </li>
          <li>
            <strong className="text-foreground">Posts:</strong> the media, caption and metadata you
            or your agent schedule, when it is due, and what the platform reports back (published,
            failed, view counts) once it is live.
          </li>
          <li>
            <strong className="text-foreground">Uploaded media:</strong> video and image files you
            upload are stored in our bucket for as long as a scheduled post needs them. A file that
            no post uses is deleted after 24 hours.
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
        <h2 className="text-base font-semibold">YouTube API Services</h2>
        <p>
          {siteConfig.name} uses YouTube API Services to upload videos, set their details,
          thumbnails, captions and playlists, and read their status, comments and analytics on the
          YouTube channels you connect. When you connect a YouTube channel, Google's handling of
          your data is governed by the{" "}
          <a href="https://policies.google.com/privacy" className="text-foreground underline">
            Google Privacy Policy
          </a>
          , and your use of YouTube by the{" "}
          <a href="https://www.youtube.com/t/terms" className="text-foreground underline">
            YouTube Terms of Service
          </a>
          .
        </p>
        <p>
          You can revoke {siteConfig.name}'s access to your Google account at any time from{" "}
          <a
            href="https://security.google.com/settings/security/permissions"
            className="text-foreground underline"
          >
            Google's security settings
          </a>
          , in addition to disconnecting the channel in {siteConfig.name}. Each other platform has
          its own place to remove connected apps, and its own privacy policy for the data it holds.
        </p>
        <p>
          {siteConfig.name} checks every day that its access to each YouTube channel still stands,
          and refreshes the channel's name and picture from YouTube at the same time. Once access is
          revoked, the channel's stored tokens are deleted as soon as {siteConfig.name} learns of
          it, and the channel and its posts in {siteConfig.name} are deleted within 7 days unless
          you connect it again.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Cookies and local storage</h2>
        <p>
          We use cookies only to sign you in and keep you signed in, and remember your light or dark
          theme in your browser's local storage. We use no advertising or tracking cookies and no
          third-party analytics.
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
          delete its data — profile, channels and their tokens, posts, files and API keys — write to
          us at the email below.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Contact</h2>
        <p>
          Questions or complaints about this policy or your data:{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-foreground underline">
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
