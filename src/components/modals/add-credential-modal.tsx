import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Check, Copy, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { colors } from "../ui/tokens.stylex";
import { addCredential } from "#/modules/social/social.fn";

export interface AddCredentialModalProps {
  providers: { id: string; name: string }[];
  redirectUris: Record<string, string>;
  onClose: () => void;
  onSaved?: () => void;
}

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: "0.875rem" },
  field: { display: "grid", fontSize: "0.8125rem", fontWeight: 500, gap: "0.375rem" },
  select: {
    backgroundColor: colors.card,
    borderColor: colors.input,
    borderRadius: "0.75rem",
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    fontFamily: "inherit",
    fontSize: "0.875rem",
    height: "2.25rem",
    paddingInline: "0.625rem",
  },
  hint: { color: colors.mutedForeground, fontSize: "0.75rem", lineHeight: 1.55, margin: 0 },
  copy: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: "0.625rem",
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "flex",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.72rem",
    gap: "0.5rem",
    justifyContent: "space-between",
    paddingBlock: "0.5rem",
    paddingInline: "0.625rem",
    textAlign: "start",
    wordBreak: "break-all",
  },
  error: { color: colors.destructive, fontSize: "0.75rem", margin: 0 },
  footer: { display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
});

/** Where each platform's OAuth app is made, shown with the redirect URI to paste there. */
const SETUP: Record<string, string> = {
  youtube:
    "For YouTube, create an OAuth client ID (Web application) in Google Cloud with this redirect URI.",
  facebook:
    'For Facebook, create a Meta app with the use case "Manage everything on your Page", set it to Live, and add this redirect URI under Facebook Login › Valid OAuth Redirect URIs.',
  instagram:
    "For Instagram, use the same Meta app as Facebook: add the Instagram use case (Facebook Login) and this redirect URI too. The Instagram account must be Business or Creator and linked to a Page.",
  threads:
    'For Threads, create a Meta app with the use case "Access the Threads API", add this redirect URI, and add your profile as a Threads Tester (accept it in Threads › Settings › Website permissions). Use the Threads App ID and secret.',
  tiktok:
    "For TikTok, create an app in the TikTok developer portal with Login Kit and the Content Posting API (Direct Post), and add this redirect URI. Until TikTok audits the app, posts can only be private.",
  pinterest:
    "For Pinterest, create an app at developers.pinterest.com (a business account is required) and add this redirect URI.",
};

/**
 * Adds an OAuth app credential (the user's own Google or Meta app), which channels
 * are then connected through. Opened through useModal().openModal.
 */
export function AddCredentialModal({
  providers,
  redirectUris,
  onClose,
  onSaved,
}: AddCredentialModalProps) {
  const [form, setForm] = useState({
    provider: providers[0]?.id ?? "youtube",
    label: "",
    clientId: "",
    clientSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = redirectUris[form.provider];

  const copy = async () => {
    await navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addCredential({ data: form });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the credential");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={save} {...stylex.props(styles.form)}>
        <ModalHeader>
          <ModalTitle>Add an app credential</ModalTitle>
          <ModalDescription>
            mixetape posts through your own OAuth app, so the quota and the approval stay yours.{" "}
            {SETUP[form.provider] ?? "Create an OAuth app with this redirect URI."} Then paste its
            ID and secret here.
          </ModalDescription>
        </ModalHeader>

        {providers.length > 1 && (
          <label {...stylex.props(styles.field)}>
            Platform
            <select
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}
              {...stylex.props(styles.select)}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" onClick={copy} {...stylex.props(styles.copy)}>
          <span>{redirectUri}</span>
          {copied ? <Check /> : <Copy />}
        </button>

        <label {...stylex.props(styles.field)}>
          Label
          <Input
            placeholder="e.g. My Google app"
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
          />
        </label>
        <label {...stylex.props(styles.field)}>
          Client ID
          <Input
            value={form.clientId}
            onChange={(event) => setForm({ ...form, clientId: event.target.value })}
            required
          />
        </label>
        <label {...stylex.props(styles.field)}>
          Client secret
          <Input
            type="password"
            autoComplete="off"
            value={form.clientSecret}
            onChange={(event) => setForm({ ...form, clientSecret: event.target.value })}
            required
          />
        </label>
        <p {...stylex.props(styles.hint)}>The secret is stored encrypted.</p>
        {error && <p {...stylex.props(styles.error)}>{error}</p>}

        <div {...stylex.props(styles.footer)}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <SpinnerGap className="animate-spin" />} Save credential
          </Button>
        </div>
      </form>
    </Modal>
  );
}
