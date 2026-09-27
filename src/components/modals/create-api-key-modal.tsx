import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Check, Copy, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { colors } from "../ui/tokens.stylex";
import { createApiKey } from "#/modules/social/social.fn";

export interface CreateApiKeyModalProps {
  /** Permission → what it allows (API_SCOPES). */
  scopes: Record<string, string>;
  baseUrl: string;
  onClose: () => void;
  onCreated?: () => void;
}

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: "0.875rem" },
  field: { display: "grid", fontSize: "0.8125rem", fontWeight: 500, gap: "0.375rem" },
  scopes: { borderStyle: "none", display: "grid", gap: "0.5rem", margin: 0, padding: 0 },
  legend: { fontSize: "0.8125rem", fontWeight: 500, paddingBlockEnd: "0.375rem" },
  scope: { alignItems: "flex-start", display: "flex", fontSize: "0.8125rem", gap: "0.5rem" },
  checkbox: {
    accentColor: colors.primary,
    flexShrink: 0,
    height: "1rem",
    marginTop: "0.1rem",
    width: "1rem",
  },
  scopeName: { fontFamily: MONO, fontSize: "0.75rem", fontWeight: 600 },
  scopeText: { color: colors.mutedForeground },
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
  code: {
    backgroundColor: colors.muted,
    borderRadius: "0.625rem",
    fontFamily: MONO,
    fontSize: "0.7rem",
    lineHeight: 1.6,
    margin: 0,
    overflowX: "auto",
    padding: "0.625rem",
    whiteSpace: "pre",
  },
  hint: { color: colors.mutedForeground, fontSize: "0.75rem", margin: 0 },
  error: { color: colors.destructive, fontSize: "0.75rem", margin: 0 },
  footer: { display: "flex", gap: "0.5rem", justifyContent: "flex-end" },
});

/** Creates an API key with chosen permissions, then shows it — once — with how to use it. */
export function CreateApiKeyModal({ scopes, baseUrl, onClose, onCreated }: CreateApiKeyModalProps) {
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>(["read", "publish", "storage"]);
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (scope: string) =>
    setChosen((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setKey((await createApiKey({ data: { name, scopes: chosen } })).key);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the key");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (key) {
    const mcp = `claude mcp add --transport http mixetape ${baseUrl}/mcp \\\n  --header "Authorization: Bearer ${key}"`;
    return (
      <Modal open onOpenChange={(open) => !open && onClose()}>
        <div {...stylex.props(styles.form)}>
          <ModalHeader>
            <ModalTitle>Copy your key now</ModalTitle>
            <ModalDescription>
              It is shown only this once; mixetape keeps a hash of it.
            </ModalDescription>
          </ModalHeader>
          <button type="button" onClick={() => copy(key)} {...stylex.props(styles.secret)}>
            <span>{key}</span>
            {copied ? <Check /> : <Copy />}
          </button>
          <p {...stylex.props(styles.hint)}>Add it to an agent (Claude Code):</p>
          <pre {...stylex.props(styles.code)}>{mcp}</pre>
          <div {...stylex.props(styles.footer)}>
            <Button type="button" variant="outline" onClick={() => copy(mcp)}>
              <Copy /> Copy command
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <form onSubmit={create} {...stylex.props(styles.form)}>
        <ModalHeader>
          <ModalTitle>New API key</ModalTitle>
          <ModalDescription>
            For one agent or pipeline. Give it only the permissions its job needs.
          </ModalDescription>
        </ModalHeader>
        <label {...stylex.props(styles.field)}>
          Name
          <Input
            placeholder="e.g. weekly pipeline"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <fieldset {...stylex.props(styles.scopes)}>
          <legend {...stylex.props(styles.legend)}>Permissions</legend>
          {Object.entries(scopes).map(([scope, label]) => (
            <label key={scope} {...stylex.props(styles.scope)}>
              <input
                type="checkbox"
                checked={chosen.includes(scope)}
                onChange={() => toggle(scope)}
                {...stylex.props(styles.checkbox)}
              />
              <span>
                <span {...stylex.props(styles.scopeName)}>{scope}</span>
                <span {...stylex.props(styles.scopeText)}> — {label}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p {...stylex.props(styles.error)}>{error}</p>}
        <div {...stylex.props(styles.footer)}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || chosen.length === 0}>
            {busy && <SpinnerGap className="animate-spin" />} Create key
          </Button>
        </div>
      </form>
    </Modal>
  );
}
