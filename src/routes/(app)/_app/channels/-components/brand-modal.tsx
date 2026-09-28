import { useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { saveBrand } from "#/modules/social/social.fn";

type Channel = { id: string; provider: string; name: string; avatar: string | null };
type Brand = { id: string; name: string; accountIds: string[] };

/** Names a brand and picks its channels, across platforms. */
export function BrandModal({
  brand,
  channels,
  platformName,
  onClose,
  onSaved,
}: {
  brand?: Brand;
  channels: Channel[];
  platformName: (provider: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(brand?.name ?? "");
  const [chosen, setChosen] = useState<string[]>(brand?.accountIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveBrand({ data: { id: brand?.id, name, accountIds: chosen } });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the brand");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={save} className="flex max-h-[80vh] flex-col gap-4">
        <ModalHeader>
          <ModalTitle>{brand ? "Edit brand" : "New brand"}</ModalTitle>
          <ModalDescription>
            A brand groups the channels one show or business posts to, on every platform.
          </ModalDescription>
        </ModalHeader>
        <label className="grid gap-1.5 text-[13px] font-medium">
          Name
          <Input
            placeholder="e.g. Hans Explainer"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <fieldset className="grid min-h-0 gap-1.5">
          <legend className="pb-1.5 text-[13px] font-medium">Channels</legend>
          <ul className="min-h-0 divide-y divide-border overflow-y-auto rounded-xl ring-1 ring-border">
            {channels.map((channel) => (
              <li key={channel.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={chosen.includes(channel.id)}
                    onChange={() => toggle(channel.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <ChannelAvatar
                    provider={channel.provider}
                    avatar={channel.avatar}
                    name={channel.name}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{channel.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {platformName(channel.provider)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy && <SpinnerGap className="animate-spin" />} {brand ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
