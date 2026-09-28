import { useEffect, useRef, useState } from "react";
import { Check, Copy, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import {
  beginChannelConnect,
  checkChannelConnect,
  chooseConnectChannels,
} from "#/modules/social/social.fn";
import type { ChannelChoice } from "#/modules/social/social.service";
import { ChannelAvatar } from "#/components/ui/channel-avatar";

export interface ConnectChannelModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  /** The platform to connect, e.g. "facebook". */
  provider: string;
  /** The platform's name, e.g. "Facebook". */
  platform: string;
  /** Set when reconnecting an existing channel, for the title. */
  channel?: string;
  /**
   * The tab the consent screen goes to — opened by the caller inside the click handler,
   * since a tab opened later (after an await) is what popup blockers stop.
   */
  tab?: Window | null;
  onConnected?: (channels: string[]) => void;
}

/**
 * Connecting a channel: the consent screen opens in a new tab straight away and this modal
 * waits for it. The same URL is shown to copy into another browser (the one signed in to
 * the channel's account): the callback lands on mixetape either way, and this modal
 * learns the result by watching the attempt. When the consent reached several new channels
 * (a person's Pages, say), the modal lists them to pick from before any is added.
 * Mounted fresh for every attempt by ModalProvider (openConnectChannel).
 */
export function ConnectChannelModal({
  open,
  onOpenChange,
  showModal,
  setShowModal,
  provider,
  platform,
  channel,
  tab,
  onConnected,
}: ConnectChannelModalProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [choice, setChoice] = useState<{ refreshed: string[]; choices: ChannelChoice[] } | null>(
    null,
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const started = useRef(false);
  // The latest callback, so a parent re-render does not restart the polling below.
  const connected = useRef(onConnected);
  connected.current = onConnected;

  // Point the already-open tab at the consent URL once the server has made one.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setBlocked(!tab);
    beginChannelConnect({ data: { provider } })
      .then((started) => {
        setUrl(started.url);
        setState(started.state);
        if (tab) tab.location.href = started.url;
      })
      .catch((err) => {
        tab?.close();
        setError(err instanceof Error ? err.message : "Could not start connecting");
      });
  }, [provider, tab]);

  // Watch the attempt: the callback stores its outcome under the state.
  useEffect(() => {
    // Stops once the modal is closed; reopening starts a new attempt.
    if (!state || open === false) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const result = await checkChannelConnect({ data: { state } });
        if (stopped) return;
        if (result.status === "done") {
          stopped = true;
          clearInterval(timer);
          connected.current?.(result.channels);
        } else if (result.status === "choose") {
          stopped = true;
          clearInterval(timer);
          setChoice({ refreshed: result.refreshed, choices: result.choices });
        } else if (result.status === "error") {
          stopped = true;
          clearInterval(timer);
          setError(result.error);
        }
      } catch {
        // A missed poll is harmless; the next one tries again.
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [state, open]);

  const close = () => {
    setShowModal?.(false);
    onOpenChange?.(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

  const add = async () => {
    if (!choice) return;
    setAdding(true);
    setError(null);
    try {
      const { channels } = await chooseConnectChannels({
        data: { state, platformAccountIds: picked },
      });
      connected.current?.([...choice.refreshed, ...channels]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the channels");
    } finally {
      setAdding(false);
    }
  };

  const waiting = !error && Boolean(state);

  if (choice) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        showModal={showModal}
        setShowModal={setShowModal}
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <ModalHeader className="pb-0">
            <ModalTitle>Choose {platform} channels</ModalTitle>
            <ModalDescription>
              {platform} gave access to these. Pick the ones your agents may post to.
              {choice.refreshed.length > 0 &&
                ` Already connected, and updated: ${choice.refreshed.join(", ")}.`}
            </ModalDescription>
          </ModalHeader>

          <ul className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {choice.choices.map((option) => (
              <li key={option.platformAccountId}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={picked.includes(option.platformAccountId)}
                    onChange={() => toggle(option.platformAccountId)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <ChannelAvatar provider={provider} avatar={option.avatar} name={option.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{option.name}</span>
                    {option.handle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.handle}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <WarningCircle className="size-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!picked.length || adding}>
              {adding && <SpinnerGap className="animate-spin" />}
              {picked.length > 1 ? `Add ${picked.length} channels` : "Add channel"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      showModal={showModal}
      setShowModal={setShowModal}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <ModalHeader className="pb-0">
          <ModalTitle>{channel ? `Reconnect ${channel}` : `Connect ${platform}`}</ModalTitle>
          <ModalDescription>
            Sign in to {platform} with the account that owns the channel and allow access.
          </ModalDescription>
        </ModalHeader>

        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
          {error ? (
            <>
              <WarningCircle className="size-4 shrink-0 text-destructive" />
              <span className="text-destructive">{error}</span>
            </>
          ) : (
            <>
              <SpinnerGap className="size-4 shrink-0 animate-spin text-editorial" />
              <span className="text-muted-foreground">
                {!state
                  ? "Preparing the sign-in link…"
                  : blocked
                    ? "Your browser blocked the new tab — open the link below."
                    : "Waiting for authorization in the new tab…"}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or open it in another browser
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Open this link in the browser signed in to the channel
          </p>
          <p className="text-xs text-muted-foreground">
            It finishes on its own there — this window updates when access is allowed.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={url} placeholder="…" className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copy} disabled={!url}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={close}>
            {waiting ? "Cancel" : "Close"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
