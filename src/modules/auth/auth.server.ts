import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { emailOTP, jwt, twoFactor } from "better-auth/plugins";
import { cimd } from "@better-auth/cimd";
import { mcp } from "@better-auth/mcp";
import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db, schema } from "../../database";
import { siteConfig } from "#/config/site";
import { requiredSecret, secret } from "#/modules/secrets/secrets.service";
import { ALL_SCOPES } from "#/modules/api/api-keys.service";
import { fetchClientMetadataResource } from "#/modules/oauth/client-metadata";

type Credentials = {
  secret: string;
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
};

/** Where the auth server lives; the MCP server is `${AUTH_ORIGIN}/mcp`. */
const authOrigin = () =>
  (env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || siteConfig.url).replace(/\/$/, "");

/** The MCP server, as the resource OAuth access tokens are issued for (their `aud`). */
export const mcpResource = () => `${authOrigin()}/mcp`;

/**
 * The scopes an MCP client may ask for: mixetape's API permissions (api-keys.service), plus
 * the identity scopes OAuth clients expect and offline_access for refresh tokens.
 */
export const OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", ...ALL_SCOPES];

/**
 * An MCP client registering with a callback on this machine (Claude Code's
 * http://localhost:…) or its own scheme is a native app, though it rarely says so; Better
 * Auth treats an unspecified client as a web app, which may only use https.
 */
function nativeWhenLocal(body: unknown) {
  if (!body || typeof body !== "object" || "application_type" in body) return null;
  const uris = (body as { redirect_uris?: unknown }).redirect_uris;
  if (!Array.isArray(uris)) return null;
  const local = uris.some((uri) => {
    try {
      const { protocol } = new URL(String(uri));
      return protocol === "http:" || (protocol !== "https:" && protocol.length > 1);
    } catch {
      return false;
    }
  });
  return local ? { ...body, application_type: "native" } : null;
}

function createAuth(credentials: Credentials) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        jwks: schema.jwks,
        oauthClient: schema.oauthClient,
        oauthResource: schema.oauthResource,
        oauthClientResource: schema.oauthClientResource,
        oauthRefreshToken: schema.oauthRefreshToken,
        oauthAccessToken: schema.oauthAccessToken,
        oauthConsent: schema.oauthConsent,
        oauthClientAssertion: schema.oauthClientAssertion,
      },
    }),
    secret: credentials.secret,
    baseURL: authOrigin(),
    // The jwt plugin's session-to-JWT endpoint: nothing here needs it.
    disabledPaths: ["/token"],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/oauth2/register") return;
        const body = nativeWhenLocal(ctx.body);
        if (body) return { context: { body } };
      }),
    },
    // Sign-in requests are only taken from these pages. Locally that is any dev server,
    // whatever port it landed on and whether opened as localhost or 127.0.0.1.
    trustedOrigins: [
      siteConfig.url,
      "https://mixetape.com",
      "https://www.mixetape.com",
      ...(env.APP_ENV === "production" ? [] : ["http://localhost:*", "http://127.0.0.1:*"]),
    ],
    emailAndPassword: {
      enabled: false,
    },
    user: {
      additionalFields: {
        bio: {
          type: "string",
          required: false,
        },
      },
    },
    // A provider is offered only once its credentials are set.
    socialProviders: {
      ...(credentials.github && { github: credentials.github }),
      ...(credentials.google && { google: credentials.google }),
    },
    // Signing in with GitHub or Google under an email that already has an account lands in
    // that same account, whichever method created it.
    account: {
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          // The code itself is a login credential: it is only ever printed locally, where
          // there is no EMAIL binding to deliver it. Production logs never contain it.
          const isProduction = env.APP_ENV === "production";
          console.log(`[Better Auth OTP] Sending ${type} code to ${email}`);
          if (env.EMAIL && typeof env.EMAIL.send === "function") {
            try {
              await env.EMAIL.send({
                from: env.EMAIL_FROM || `no-reply@${siteConfig.url.replace(/^https?:\/\//, "")}`,
                to: email,
                subject: "Your Login Verification Code",
                html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <h2 style="color: #0f172a; margin-top: 0;">Verification Code</h2>
                  <p style="color: #475569;">Use the following one-time password (OTP) to log in to your account:</p>
                  <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0284c7; border-radius: 6px; margin: 20px 0;">
                    ${otp}
                  </div>
                  <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
                </div>
              `,
                text: `Your verification code is ${otp}. It expires in 5 minutes.`,
              });
              console.log(
                `[Better Auth OTP] Email sent successfully via Cloudflare EMAIL binding to ${email}`,
              );
            } catch (error) {
              console.error(
                "[Better Auth OTP] Failed to send email via Cloudflare EMAIL binding:",
                error,
              );
            }
          } else {
            if (isProduction) {
              console.error(
                "[Better Auth OTP] EMAIL binding missing in production; code not delivered",
              );
            } else {
              console.warn(
                `[Better Auth OTP] No EMAIL binding (local dev). Code for ${email}: ${otp}`,
              );
            }
          }
        },
      }),
      twoFactor({
        issuer: siteConfig.name,
        allowPasswordless: true,
      }),
      // OAuth 2.1 for MCP clients, so Claude, ChatGPT or Cursor connect with a sign-in
      // instead of a pasted API key. jwt signs the access tokens (audience: /mcp); mcp is
      // the authorization server; clients register themselves (RFC 7591) or identify by a
      // metadata document URL (cimd). The person signs in on /oauth/login and picks the
      // permissions on /oauth/consent; the token carries them as scopes (api/http.ts).
      jwt(),
      mcp({
        resource: mcpResource(),
        loginPage: "/oauth/login",
        consentPage: "/oauth/consent",
        scopes: OAUTH_SCOPES,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
      tanstackStartCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

async function pair(id: "GITHUB" | "GOOGLE") {
  const [clientId, clientSecret] = await Promise.all([
    secret(`${id}_CLIENT_ID`),
    secret(`${id}_CLIENT_SECRET`),
  ]);
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

let instance: Promise<Auth> | undefined;

/**
 * The Better Auth instance, made on first use: its secret and the GitHub and Google
 * credentials come from the Secrets Store, which is read asynchronously.
 */
export function getAuth(): Promise<Auth> {
  instance ??= (async () =>
    createAuth({
      secret: await requiredSecret("BETTER_AUTH_SECRET"),
      github: await pair("GITHUB"),
      google: await pair("GOOGLE"),
    }))();
  return instance;
}

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const headers = getRequestHeaders();
    if (!headers) return null;

    const session = await (
      await getAuth()
    ).api.getSession({
      headers,
    });
    return session;
  } catch (error) {
    console.error("Failed to get auth session on server:", error);
    return null;
  }
});

/** The signed-in user's id, for server functions; throws when nobody is signed in. */
export async function currentUserId(): Promise<string> {
  const headers = getRequestHeaders();
  const session = headers
    ? await (await getAuth()).api.getSession({ headers }).catch(() => null)
    : null;
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}
