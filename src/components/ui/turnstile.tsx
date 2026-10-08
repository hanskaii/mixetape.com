import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load"));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * A Cloudflare Turnstile check. It hands its token to `onToken` once passed, and null when
 * the token expires or the check fails. A token works once: render it again (a new `key`)
 * after each request it was used for.
 */
export function Turnstile({
  sitekey,
  action,
  onToken,
}: {
  sitekey: string;
  action: string;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // The latest callback, without re-rendering the widget when the parent re-renders.
  const handler = useRef(onToken);
  handler.current = onToken;

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widgetId = turnstile.render(container.current, {
          sitekey,
          action,
          size: "flexible",
          theme: "auto",
          callback: (token: string) => handler.current(token),
          "expired-callback": () => handler.current(null),
          "error-callback": () => handler.current(null),
        });
      })
      .catch(() => handler.current(null));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [sitekey, action]);

  return <div ref={container} className="min-h-[65px]" />;
}
