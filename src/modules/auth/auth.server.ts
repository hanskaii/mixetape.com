import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db, schema } from "../../database";
import { siteConfig } from "#/config/site";
import { requiredSecret, secret } from "#/modules/secrets/secrets.service";

type Credentials = {
  secret: string;
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
};

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
      },
    }),
    secret: credentials.secret,
    baseURL: env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || siteConfig.url,
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:8787",
      siteConfig.url,
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
