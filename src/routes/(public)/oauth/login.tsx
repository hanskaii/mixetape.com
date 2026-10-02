import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { useModal } from "#/components/providers/modal-providers";
import { siteConfig } from "#/config/site";
import { authClient } from "#/modules/auth/auth-client";
import { Route as RootRoute } from "#/routes/__root";
import { follow, OAuthCard, OAuthError, styles } from "./-components/oauth-card";

/**
 * Better Auth's login page for the OAuth flow (mcp plugin, auth.server.ts): an MCP client
 * sent someone signed out. Once they sign in — email code, Google or GitHub — the flow
 * continues to the consent page; the signed request rides along in the URL.
 */
export const Route = createFileRoute("/(public)/oauth/login")({
  head: () => ({
    meta: [
      { title: `Sign in to connect an app | ${siteConfig.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  const router = useRouter();
  const { openLogin } = useModal();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    authClient.oauth2
      .continue({ postLogin: true })
      .then(follow)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not continue to the app"),
      );
  }, [signedIn]);

  return (
    <OAuthCard title="Sign in to connect an app">
      {signedIn && !error ? (
        <p {...stylex.props(styles.text)}>
          <SpinnerGap className="animate-spin" /> Continuing…
        </p>
      ) : (
        <>
          <p {...stylex.props(styles.text)}>
            An app wants to use your mixetape. Sign in first; you choose what it may do on the next
            step.
          </p>
          {error && <OAuthError message={error} />}
          <div {...stylex.props(styles.actions)}>
            <Button onClick={() => openLogin({ onSuccess: () => router.invalidate() })}>
              Sign in
            </Button>
          </div>
        </>
      )}
    </OAuthCard>
  );
}
