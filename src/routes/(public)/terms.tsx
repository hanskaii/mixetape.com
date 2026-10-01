import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(public)/terms")({
  head: () => ({ meta: [{ title: `Terms | ${siteConfig.name}` }] }),
  component: Terms,
});

/** The terms of service TikTok, Pinterest and Meta ask for next to the privacy policy. */
function Terms() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-10 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated October 1, 2026</p>
      </div>

      <section className="space-y-2">
        <p>
          {siteConfig.name} schedules and publishes posts to the social media channels you connect,
          and lets AI agents you authorize do the same through an API. By signing in or using the
          API you agree to these terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your account and channels</h2>
        <p>
          You may connect only channels you own or are authorized to manage. You are responsible for
          everything published through your account, including posts scheduled by agents or scripts
          that use your API keys. Keep your API keys secret and revoke any you no longer use.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your content</h2>
        <p>
          You keep all rights to the media and text you upload or schedule. You give{" "}
          {siteConfig.name} permission to store it and send it to the platforms you choose, only to
          do what you ask. You confirm you have the rights to publish it and that it follows the
          rules of each platform you post to.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Platform rules</h2>
        <p>
          Each platform (YouTube, Facebook, Instagram, Threads, TikTok, Pinterest) has its own
          terms, content policies and limits, and they apply to your posts. A platform may refuse a
          post, limit your account or remove content; {siteConfig.name} does not control those
          decisions. You can revoke {siteConfig.name}'s access at any time from the platform's
          settings or by disconnecting the channel.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Acceptable use</h2>
        <p>
          Do not use {siteConfig.name} to post unlawful, deceptive or abusive content, to spam, to
          evade a platform's limits, or to interfere with the service or other users.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Availability</h2>
        <p>
          We work to publish at the time you set, but the service is provided as is, without
          guarantees. Platform outages, quota limits or API changes can delay or fail a post; we
          show the status of every post so you can retry it. To the extent the law allows,{" "}
          {siteConfig.name} is not liable for lost reach, revenue or content arising from the use of
          the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ending your use</h2>
        <p>
          You can stop at any time by disconnecting your channels and asking us to delete your
          account. We may suspend access that breaks these terms or a platform's rules. See the{" "}
          <a href="/privacy" className="text-foreground underline">
            Privacy Policy
          </a>{" "}
          for how your data is handled and deleted.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Changes and contact</h2>
        <p>
          We may update these terms; the date above shows the latest version, and continued use
          means you accept it. Questions:{" "}
          <a href="mailto:hanssn@mixetape.com" className="text-foreground underline">
            hanssn@mixetape.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
