import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db, schema } from "../../database";
import { siteConfig } from "#/config/site";

export const auth = betterAuth({
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
  secret: env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET,
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
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "",
      clientSecret: env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || "",
    },
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

export type Auth = typeof auth;

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const headers = getRequestHeaders();
    if (!headers) return null;

    const session = await auth.api.getSession({
      headers,
    });
    return session;
  } catch (error) {
    console.error("Failed to get auth session on server:", error);
    return null;
  }
});
