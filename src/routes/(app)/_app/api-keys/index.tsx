import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Key, SpinnerGap, Trash } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { PublishingTabs } from "#/components/layouts/publishing-tabs";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { createApiKey, getApiKeys, removeApiKey } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/api-keys/")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
  },
  loader: () => getApiKeys(),
  head: () => ({ meta: [{ title: `API | ${siteConfig.name}` }] }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const router = useRouter();
  const { keys, baseUrl } = Route.useLoaderData();
  const { confirm } = useConfirmModal();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { key } = await createApiKey({ data: { name } });
      setCreated(key);
      setName("");
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const example = `curl -X POST ${baseUrl}/api/v1/posts \\
  -H "Authorization: Bearer ${created ?? "mxt_…"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "accountId": "<id from GET /api/v1/accounts>",
    "mediaUrl": "https://…/video.mp4",
    "scheduledAt": "2026-10-01T17:00:00+07:00",
    "metadata": { "title": "My video", "description": "…", "category": "27", "privacyStatus": "public" }
  }'`;

  return (
    <main className="space-y-8 px-4 py-8 md:py-12">
      <PublishingTabs />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Let scripts and pipelines schedule posts: <code>GET /api/v1/accounts</code>,{" "}
          <code>POST /api/v1/posts</code>, <code>GET|DELETE /api/v1/posts/:id</code>,{" "}
          <code>POST /api/v1/posts/:id</code> to retry a failed one.
        </p>

        <form onSubmit={create} className="flex max-w-xl gap-2">
          <Input
            placeholder="Key name (e.g. daily pipeline)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? <SpinnerGap className="animate-spin" /> : <Key />} Create
          </Button>
        </form>

        {created && (
          <div className="max-w-2xl space-y-1 rounded-2xl bg-amber-500/10 p-4">
            <p className="text-xs font-medium">Copy this key now — it will not be shown again.</p>
            <button
              type="button"
              onClick={() => copy(created)}
              className="flex max-w-full items-center gap-2 font-mono text-xs"
            >
              <span className="truncate">{created}</span>
              {copied ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <Copy className="size-3.5 shrink-0" />
              )}
            </button>
          </div>
        )}

        {keys.length > 0 && (
          <ul className="max-w-2xl divide-y divide-border/60 rounded-2xl ring-1 ring-foreground/10">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {key.prefix}… ·{" "}
                    {key.lastUsedAt
                      ? `used ${new Date(key.lastUsedAt).toLocaleString()}`
                      : "never used"}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${key.name}`}
                  onClick={() =>
                    confirm({
                      title: "Delete this API key?",
                      description: `Anything using "${key.name}" stops working at once.`,
                      confirmText: "Delete",
                      variant: "destructive",
                      onConfirm: async () => {
                        await removeApiKey({ data: { id: key.id } });
                        await router.invalidate();
                      },
                    })
                  }
                >
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Example</h2>
        <pre className="max-w-3xl overflow-x-auto rounded-2xl bg-muted/50 p-4 text-xs">
          {example}
        </pre>
      </section>
    </main>
  );
}
