import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    // On the OAuth pages, carries the signed authorization request with sign-in and consent.
    oauthProviderClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/";
      },
    }),
  ],
});

export const { useSession, signIn, signOut } = authClient;
