import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";
import { getDeletionStatus } from "./-fn/data-deletion.fn";
import { publicHead } from "./-lib/head";

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
};

export const Route = createFileRoute("/(public)/data-deletion")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ deps }) => ({
    code: deps.code,
    status: deps.code ? await getDeletionStatus({ data: { code: deps.code } }) : null,
  }),
  head: () =>
    publicHead({
      path: "/data-deletion",
      title: `Delete your data | ${siteConfig.name}`,
      description:
        "How to delete the data mixetape holds about you and your connected channels, and how to check a deletion request made from Facebook, Instagram or Threads.",
    }),
  component: DataDeletion,
});

/**
 * The data deletion instructions Meta asks for (and the status page its data deletion
 * callback points people to, with ?code=). Written from what mixetape stores — see the
 * privacy policy.
 */
function DataDeletion() {
  const { code, status } = Route.useLoaderData();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-10 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delete your data</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated October 3, 2026</p>
      </div>

      {code && (
        <section
          aria-live="polite"
          className="space-y-1 rounded-xl border border-border bg-card px-4 py-3"
        >
          <h2 className="text-base font-semibold">Request {code.toUpperCase()}</h2>
          {status ? (
            <p>
              Received from {PLATFORM_NAMES[status.provider] ?? status.provider} on{" "}
              {new Date(status.at).toUTCString()} and completed:{" "}
              {status.deleted === 0
                ? "mixetape held no channels for that account."
                : `${status.deleted} connected channel${status.deleted === 1 ? "" : "s"} and ${status.deleted === 1 ? "its" : "their"} posts were deleted.`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              No request with this code — check it, or it is older than 90 days. Write to us at the
              email below if you need help.
            </p>
          )}
        </section>
      )}

      <section className="space-y-2">
        <p>
          {siteConfig.name} keeps what it needs to publish for you: your account, the channels you
          connect (their names, avatars and access tokens, stored encrypted), the posts you or your
          agents schedule, files you upload, and API keys. See the{" "}
          <a href="/privacy" className="text-foreground underline">
            privacy policy
          </a>{" "}
          for the details.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Remove one channel</h2>
        <p>
          In the workspace, open <strong>Channels</strong> and disconnect it (cancel its scheduled
          posts first). Its access tokens and its posts in {siteConfig.name} are deleted at once.
          Posts already published stay on the platform; delete those there.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">From Facebook, Instagram or Threads</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Remove the app:</strong> in Facebook (Settings → Apps and websites), Instagram
            (Settings → Website permissions → Apps and websites) or Threads (Settings → Account →
            Website permissions), remove {siteConfig.name}. Its access to that account ends and the
            channel shows “reconnect” in {siteConfig.name}.
          </li>
          <li>
            <strong>Ask for your data to be deleted:</strong> in the same place, choose to send a
            data deletion request for {siteConfig.name}. The channels you connected from that
            account and their posts are deleted at once, and the platform gives you a confirmation
            code you can check on this page.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Delete everything</h2>
        <p>
          To close your {siteConfig.name} account and delete all its data — profile, channels and
          their tokens, posts, files, groups, brands, webhooks and API keys — sign in and open{" "}
          <strong>Settings → Account → Delete account</strong>. It happens at once and we confirm by
          email. A plan that still renews is cancelled in Billing first. Cannot sign in any more?
          Write to{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-foreground underline">
            {siteConfig.contactEmail}
          </a>{" "}
          from the email you used, and we delete it within 30 days.
        </p>
      </section>
    </div>
  );
}
