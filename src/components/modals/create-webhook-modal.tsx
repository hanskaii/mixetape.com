import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Check, Copy, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { colors } from "../ui/tokens.stylex";
import { addWebhook } from "#/modules/webhooks/webhooks.fn";

export interface CreateWebhookModalProps {
  /** Event → what it means (WEBHOOK_EVENTS). */
  events: Record<string, string>;
  onClose: () => void;
  onCreated?: () => void;
}

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: "0.875rem" },
  field: { display: "grid", fontSize: "0.8125rem", fontWeight: 500, gap: "0.375rem" },
  events: { borderStyle: "none", display: "grid", gap: "0.5rem", margin: 0, padding: 0 },
  legend: { fontSize: "0.8125rem", fontWeight: 500, paddingBlockEnd: "0.375rem" },
  event: { alignItems: "flex-start", display: "flex", fontSize: "0.8125rem", gap: "0.5rem" },
  checkbox: {
    accentColor: colors.primary,
    flexShrink: 0,
    height: "1rem",
    marginTop: "0.1rem",
    width: "1rem",
  },
  eventName: { fontFamily: MONO, fontSize: "0.75rem", fontWeight: 600 },
  eventText: { color: colors.mutedForeground },
  secret: {
    alignItems: "center",
    backgroundColor: "color-mix(in oklab, #f59e0b 14%, transparent)",
    borderRadius: "0.625rem",
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "flex",
    fontFamily: MONO,
    fontSize: "0.75rem",
    gap: "0.5rem",
    justifyContent: "space-between",
    padding: "0.625rem",
    textAlign: "start",
    wordBreak: "break-all",
  },
  hint: { color: colors.mutedForeground, fontSize: "0.75rem", lineHeight: 1.55, margin: 0 },
  error: { color: colors.destructive, fontSize: "0.75rem", margin: 0 },
  footer: { display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
});

/** Adds a webhook, then shows its signing secret — once. */
export function CreateWebhookModal({ events, onClose, onCreated }: CreateWebhookModalProps) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [chosen, setChosen] = useState<string[]>(Object.keys(events));
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (event: string) =>
    setChosen((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );

  const create = async (submit: React.FormEvent) => {
    submit.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await addWebhook({ data: { url, events: chosen, description } });
      setSecret(created.secret);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the webhook");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (secret)
    return (
      <Modal open onOpenChange={(open) => !open && onClose()}>
        <div {...stylex.props(styles.form)}>
          <ModalHeader>
            <ModalTitle>Copy the signing secret</ModalTitle>
            <ModalDescription>It is shown only this once.</ModalDescription>
          </ModalHeader>
          <button type="button" onClick={() => copy(secret)} {...stylex.props(styles.secret)}>
            <span>{secret}</span>
            {copied ? <Check /> : <Copy />}
          </button>
          <p {...stylex.props(styles.hint)}>
            Each delivery carries webhook-id, webhook-timestamp and webhook-signature headers
            (Standard Webhooks); check the signature with this secret before trusting the body.
          </p>
          <div {...stylex.props(styles.footer)}>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={create} {...stylex.props(styles.form)}>
        <ModalHeader>
          <ModalTitle>New webhook</ModalTitle>
          <ModalDescription>
            mixetape POSTs to this endpoint when something you pick happens, retrying for about an
            hour if it is down.
          </ModalDescription>
        </ModalHeader>
        <label {...stylex.props(styles.field)}>
          Endpoint URL
          <Input
            type="url"
            required
            placeholder="https://example.com/hooks/mixetape"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            autoFocus
          />
        </label>
        <label {...stylex.props(styles.field)}>
          Note
          <Input
            placeholder="e.g. weekly pipeline"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <fieldset {...stylex.props(styles.events)}>
          <legend {...stylex.props(styles.legend)}>Events</legend>
          {Object.entries(events).map(([event, label]) => (
            <label key={event} {...stylex.props(styles.event)}>
              <input
                type="checkbox"
                checked={chosen.includes(event)}
                onChange={() => toggle(event)}
                {...stylex.props(styles.checkbox)}
              />
              <span>
                <span {...stylex.props(styles.eventName)}>{event}</span>
                <span {...stylex.props(styles.eventText)}> — {label}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p {...stylex.props(styles.error)}>{error}</p>}
        <div {...stylex.props(styles.footer)}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !url || chosen.length === 0}>
            {busy && <SpinnerGap className="animate-spin" />} Add webhook
          </Button>
        </div>
      </form>
    </Modal>
  );
}
