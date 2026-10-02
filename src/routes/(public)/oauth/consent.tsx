import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";
import { authClient } from "#/modules/auth/auth-client";
import { getConsentRequest } from "#/modules/oauth/oauth.fn";
import { follow, OAuthCard, OAuthError, styles } from "./-components/oauth-card";

/**
 * Better Auth's consent page (mcp plugin, auth.server.ts): an MCP client asks to use the
 * person's mixetape; they choose its permissions. The signed authorization request stays
 * in the URL, and authClient.oauth2.consent carries it back.
 */
export const Route = createFileRoute("/(public)/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === "string" ? search.client_id : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getConsentRequest({ data: { clientId: deps.client_id, scope: deps.scope } }),
  head: () => ({
    meta: [
      { title: `Connect an app | ${siteConfig.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const data = Route.useLoaderData();
  const [chosen, setChosen] = useState<string[]>(
    data.ok ? data.permissions.map(({ scope }) => scope) : [],
  );
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data.ok)
    return (
      <OAuthCard>
        <OAuthError message={data.error} />
        <p {...stylex.props(styles.text)}>Go back to the app and connect mixetape again.</p>
      </OAuthCard>
    );

  const toggle = (scope: string) =>
    setChosen((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );

  const decide = async (accept: boolean) => {
    setBusy(accept ? "allow" : "deny");
    setError(null);
    try {
      follow(
        await authClient.oauth2.consent({
          accept,
          scope: [...data.passThrough, ...chosen].join(" "),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish connecting the app");
      setBusy(null);
    }
  };

  return (
    <OAuthCard
      title={
        <>
          Allow <span {...stylex.props(styles.app)}>{data.client.name}</span> to use your mixetape?
        </>
      }
    >
      {data.email && (
        <p {...stylex.props(styles.text)}>
          Signed in as <span {...stylex.props(styles.strong)}>{data.email}</span>. The app works
          through mixetape's MCP server with only the permissions you leave ticked — it never sees
          your password or your platform logins.
        </p>
      )}
      {!data.permissions.length && (
        <OAuthError message="The app asked for no mixetape permissions, so it could do nothing here. Connect it again from the app." />
      )}
      <fieldset {...stylex.props(styles.scopes)}>
        <legend {...stylex.props(styles.legend)}>It asks to</legend>
        {data.permissions.map(({ scope, label }) => (
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
      <p {...stylex.props(styles.text)}>
        Disconnect it any time under API keys, in Connected apps.
      </p>
      {error && <OAuthError message={error} />}
      <div {...stylex.props(styles.actions)}>
        <Button variant="outline" disabled={busy !== null} onClick={() => decide(false)}>
          {busy === "deny" && <SpinnerGap className="animate-spin" />} Deny
        </Button>
        <Button disabled={busy !== null || chosen.length === 0} onClick={() => decide(true)}>
          {busy === "allow" && <SpinnerGap className="animate-spin" />} Allow
        </Button>
      </div>
    </OAuthCard>
  );
}
