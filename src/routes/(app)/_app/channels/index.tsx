import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  Check,
  Copy,
  Plus,
  PlugsConnected,
  SpinnerGap,
  Trash,
  WarningCircle,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Badge } from "#/components/ui/badge";
import { PublishingTabs, selectClassName } from "#/components/layouts/publishing-tabs";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import {
  addCredential,
  getChannelsData,
  removeAccount,
  removeCredential,
} from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/channels/")({
  validateSearch: z.object({ connected: z.string().optional(), error: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
  },
  loader: () => getChannelsData(),
  head: () => ({ meta: [{ title: `Channels | ${siteConfig.name}` }] }),
  component: ChannelsPage,
});

function ChannelsPage() {
  const router = useRouter();
  const { credentials, accounts, providers, redirectUris } = Route.useLoaderData();
  const { connected, error } = Route.useSearch();
  const { confirm } = useConfirmModal();

  const [form, setForm] = useState({
    provider: "youtube",
    label: "",
    clientId: "",
    clientSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { openConnectChannel } = useModal();
  const connect = (credentialId: string, channel?: string) =>
    openConnectChannel({
      credentialId,
      credentialLabel: labelOf(credentialId),
      channel,
      onConnected: async (channels) => {
        await router.navigate({ to: "/channels", search: { connected: channels.join(", ") } });
        await router.invalidate();
      },
    });
  const labelOf = (credentialId: string) =>
    credentials.find((credential) => credential.id === credentialId)?.label ??
    "your app credential";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await addCredential({ data: form });
      setForm({ provider: "youtube", label: "", clientId: "", clientSecret: "" });
      await router.invalidate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the credential");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const remove = (kind: "credential" | "account", id: string, name: string) =>
    confirm({
      title: kind === "credential" ? "Remove this app credential?" : "Disconnect this channel?",
      description:
        kind === "credential"
          ? `"${name}" and every channel connected through it will be removed, with their scheduled posts.`
          : `"${name}" and its scheduled posts will be removed. Posts already on the platform stay there.`,
      confirmText: "Remove",
      variant: "destructive",
      onConfirm: async () => {
        await (kind === "credential"
          ? removeCredential({ data: { id } })
          : removeAccount({ data: { id } }));
        await router.invalidate();
      },
    });

  return (
    <main className="space-y-8 px-4 py-8 md:py-12">
      <PublishingTabs />

      {connected && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" /> Connected: {connected}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <WarningCircle className="size-4" /> {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Connected channels</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No channel yet. Add an app credential below, then connect a channel with it.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl ring-1 ring-foreground/10">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-3 px-4 py-3">
                {account.avatar ? (
                  <img src={account.avatar} alt="" className="size-8 rounded-full" />
                ) : (
                  <YoutubeLogo className="size-8 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.provider} · {account.handle ?? account.platformAccountId}
                  </p>
                </div>
                {account.status === "active" ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => connect(account.credentialId, account.name)}
                  >
                    Reconnect
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Disconnect ${account.name}`}
                  onClick={() => remove("account", account.id, account.name)}
                >
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">App credentials</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          mixetape posts through your own OAuth app, so the quota and the approval are yours. For
          YouTube: in Google Cloud, enable <b>YouTube Data API v3</b>, set up the OAuth consent
          screen, and create an <b>OAuth client ID</b> of type <b>Web application</b> with this
          authorized redirect URI:
        </p>
        <button
          type="button"
          onClick={() => copy(redirectUris.youtube)}
          className="flex max-w-full items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 font-mono text-xs"
        >
          <span className="truncate">{redirectUris.youtube}</span>
          {copied ? (
            <Check className="size-3.5 shrink-0" />
          ) : (
            <Copy className="size-3.5 shrink-0" />
          )}
        </button>

        {credentials.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-2xl ring-1 ring-foreground/10">
            {credentials.map((credential) => (
              <li key={credential.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{credential.label}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {credential.provider} · {credential.clientId}
                  </p>
                </div>
                <Button size="sm" onClick={() => connect(credential.id)}>
                  <PlugsConnected /> Connect channel
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${credential.label}`}
                  onClick={() => remove("credential", credential.id, credential.label)}
                >
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={save}
          className="grid max-w-2xl gap-3 rounded-2xl p-4 ring-1 ring-foreground/10 sm:grid-cols-2"
        >
          <select
            className={selectClassName}
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
            aria-label="Platform"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Label (e.g. My Google app)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <Input
            placeholder="Client ID"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            required
          />
          <Input
            type="password"
            placeholder="Client secret"
            autoComplete="off"
            value={form.clientSecret}
            onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
            required
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <SpinnerGap className="animate-spin" /> : <Plus />} Save credential
            </Button>
            <span className="text-xs text-muted-foreground">The secret is stored encrypted.</span>
            {formError && <span className="text-xs text-destructive">{formError}</span>}
          </div>
        </form>
      </section>
    </main>
  );
}
