import { useEffect, useRef, useState } from "react";
import { Check, Copy, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { beginChannelConnect, checkChannelConnect } from "#/modules/social/social.fn";

export interface ConnectChannelModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  /** The app credential (OAuth client) to connect through. */
  credentialId: string;
  credentialLabel: string;
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
 * the channel's Google account): the callback lands on mixetape either way, and this modal
 * learns the result by watching the attempt.
 * Mounted fresh for every attempt by ModalProvider (openConnectChannel).
 */
export function ConnectChannelModal({
  open,
  onOpenChange,
  showModal,
  setShowModal,
  credentialId,
  credentialLabel,
  channel,
  tab,
  onConnected,
}: ConnectChannelModalProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  // The latest callback, so a parent re-render does not restart the polling below.
  const connected = useRef(onConnected);
  connected.current = onConnected;

  // Point the already-open tab at the consent URL once the server has made one.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setBlocked(!tab);
    beginChannelConnect({ data: { credentialId } })
      .then((started) => {
        setUrl(started.url);
        setState(started.state);
        if (tab) tab.location.href = started.url;
      })
      .catch((err) => {
        tab?.close();
        setError(err instanceof Error ? err.message : "Could not start connecting");
      });
  }, [credentialId, tab]);

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

  const waiting = !error && Boolean(state);

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
          <ModalTitle>{channel ? `Reconnect ${channel}` : "Connect a channel"}</ModalTitle>
          <ModalDescription>
            Through <b>{credentialLabel}</b>. Sign in with the Google account that owns the channel
            and allow access.
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
              <SpinnerGap className="size-4 shrink-0 animate-spin text-primary" />
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
