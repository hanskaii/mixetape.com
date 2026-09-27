import { useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { replaceCredentialSecret } from "#/modules/social/social.fn";

export interface CredentialSecretModalProps {
  credentialId: string;
  label: string;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Replaces an app credential's client secret: after it was rotated at the provider, or
 * when the stored copy can no longer be read. Opened through useModal().openModal.
 */
export function CredentialSecretModal({
  credentialId,
  label,
  onClose,
  onSaved,
}: CredentialSecretModalProps) {
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await replaceCredentialSecret({ data: { id: credentialId, clientSecret } });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the secret");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} className="max-w-md">
      <form onSubmit={save} className="flex flex-col gap-4">
        <ModalHeader className="pb-0">
          <ModalTitle>Update client secret</ModalTitle>
          <ModalDescription>
            For <b>{label}</b>. Paste the current client secret from your OAuth app. It is stored
            encrypted; channels connected through it keep working after you reconnect them.
          </ModalDescription>
        </ModalHeader>
        <Input
          type="password"
          autoComplete="off"
          placeholder="Client secret"
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
          autoFocus
          required
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !clientSecret.trim()}>
            {saving && <SpinnerGap className="animate-spin" />} Save secret
          </Button>
        </div>
      </form>
    </Modal>
  );
}
