import { useState } from "react";
import { siteConfig } from "#/config/site";
import { Modal, ModalHeader, ModalTitle, ModalDescription } from "#/components/ui/modal";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/modules/auth/auth-client";
import { useRouter } from "@tanstack/react-router";
import { SpinnerGap } from "@phosphor-icons/react";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}

export interface LoginModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showModal?: boolean;
  setShowModal?: React.Dispatch<React.SetStateAction<boolean>>;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export function LoginModal({
  open,
  onOpenChange,
  showModal,
  setShowModal,
  title = `Sign in to ${siteConfig.name}`,
  description = "Continue with Google or GitHub, or get a 6-digit code by email — no password needed.",
  onSuccess,
}: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [socialLoading, setSocialLoading] = useState<"github" | "google" | null>(null);

  const handleSocialSignIn = async (provider: "github" | "google") => {
    setSocialLoading(provider);
    setError("");
    const name = provider === "github" ? "GitHub" : "Google";
    try {
      const res = await authClient.signIn.social({ provider, callbackURL: window.location.href });
      if (res.error) throw new Error(res.error.message || `Could not sign in with ${name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not sign in with ${name}.`);
      setSocialLoading(null);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });
      if (res.error) {
        setError(res.error.message || "Failed to send OTP code.");
      } else {
        setStep("otp");
        setSuccess(`Verification code sent to ${email}`);
      }
    } catch (err: any) {
      setError(err?.message || "Error sending code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (res.error) {
        setError(res.error.message || "Invalid verification code.");
      } else {
        onOpenChange?.(false);
        setShowModal?.(false);
        setStep("email");
        setEmail("");
        setOtp("");
        router.invalidate();
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      showModal={showModal}
      setShowModal={setShowModal}
      className="max-w-sm"
    >
      <ModalHeader>
        <ModalTitle className="text-base">{title}</ModalTitle>
        <ModalDescription>{description}</ModalDescription>
      </ModalHeader>

      {step === "email" ? (
        <div className="space-y-4 pt-2">
          {/* One-click sign in with Google or GitHub */}
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={socialLoading !== null || loading}
              onClick={() => handleSocialSignIn("google")}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold cursor-pointer"
            >
              {socialLoading === "google" ? (
                <SpinnerGap className="size-3.5 animate-spin" />
              ) : (
                <GoogleIcon className="size-3.5" />
              )}
              <span>Continue with Google</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={socialLoading !== null || loading}
              onClick={() => handleSocialSignIn("github")}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer"
            >
              {socialLoading === "github" ? (
                <SpinnerGap className="size-3.5 animate-spin" />
              ) : (
                <GithubIcon className="size-3.5" />
              )}
              <span>Continue with GitHub</span>
            </Button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-border w-full" />
            <span className="bg-card px-2 text-[10px] uppercase font-mono text-muted-foreground absolute">
              or with email
            </span>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="modal-email" className="text-xs">
                Email Address
              </Label>
              <Input
                id="modal-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>

            {error && (
              <div className="p-2 text-xs rounded bg-destructive/10 text-destructive">{error}</div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={loading || socialLoading !== null}
              className="w-full cursor-pointer"
            >
              {loading ? "Sending Code..." : "Send Verification Code"}
            </Button>
          </form>

          {/* Platform API policies (YouTube's among them) require agreeing before use. */}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              className="text-foreground underline underline-offset-2"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              className="text-foreground underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="modal-otp" className="text-xs">
              Enter 6-Digit Code
            </Label>
            <Input
              id="modal-otp"
              type="text"
              required
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="text-center font-mono tracking-widest text-base font-semibold"
            />
          </div>

          {error && (
            <div className="p-2 text-xs rounded bg-destructive/10 text-destructive">{error}</div>
          )}
          {success && (
            <div className="p-2 text-xs rounded bg-primary/10 text-editorial">{success}</div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep("email")}
              className="w-1/3 cursor-pointer"
            >
              Back
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="flex-1 cursor-pointer">
              {loading ? "Verifying..." : "Sign In"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
