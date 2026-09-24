import { useState } from "react";
import { siteConfig } from "#/config/site";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "#/components/ui/dialog";
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

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export function LoginModal({
  open,
  onOpenChange,
  title = `Sign in to ${siteConfig.name}`,
  description = "We will email you a 6-digit code — no password needed.",
  onSuccess,
}: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true);
    setError("");
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: window.location.href,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to sign in with GitHub.");
      setIsGithubLoading(false);
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
        onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <div className="space-y-4 pt-2">
            {/* One-click GitHub Sign In */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGithubLoading || loading}
              onClick={handleGithubSignIn}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isGithubLoading ? (
                <SpinnerGap className="size-3.5 animate-spin" />
              ) : (
                <GithubIcon className="size-3.5" />
              )}
              <span>Continue with GitHub</span>
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-background px-2 text-[10px] uppercase font-mono text-muted-foreground absolute">
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
                <div className="p-2 text-xs rounded bg-destructive/10 text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={loading || isGithubLoading}
                className="w-full"
              >
                {loading ? "Sending Code..." : "Send Verification Code"}
              </Button>
            </form>
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
              <div className="p-2 text-xs rounded bg-primary/10 text-primary">{success}</div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("email")}
                className="w-1/3"
              >
                Back
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="flex-1">
                {loading ? "Verifying..." : "Sign In"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
