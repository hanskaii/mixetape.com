import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";

// Where the tab that ran the consent screen lands. The Channels page that opened it is
// already watching for the result, so on success this tab closes itself when the browser
// allows it (a tab opened by a script may be closed by one).
export const Route = createFileRoute("/(public)/connect/done")({
  validateSearch: z.object({ connected: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: `Connect | ${siteConfig.name}` }] }),
  component: ConnectDone,
});

function ConnectDone() {
  const { connected, error } = Route.useSearch();
  const ok = connected !== undefined && !error;

  useEffect(() => {
    if (!ok) return;
    const timer = setTimeout(() => window.close(), 1200);
    return () => clearTimeout(timer);
  }, [ok]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10">
        {ok ? (
          <CheckCircle className="mx-auto size-9 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto size-9 text-destructive" />
        )}
        <h1 className="text-lg font-semibold">{ok ? "Channel connected" : "Could not connect"}</h1>
        <p className="text-sm text-muted-foreground">
          {ok
            ? `${connected}. You can close this tab — mixetape has already updated.`
            : (error ?? "The sign-in did not finish.")}
        </p>
        <Button variant="outline" size="sm" render={<Link to="/channels" />}>
          Go to Channels
        </Button>
      </div>
    </main>
  );
}
