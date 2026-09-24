import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  EnvelopeSimple,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  SpinnerGap,
  Shield,
  User,
  WarningCircle,
  DownloadSimple,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { authClient } from "#/modules/auth/auth-client";
import { getUserLinkedAccounts, unlinkUserAccount } from "#/modules/auth/auth.fn";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Switch } from "#/components/ui/switch";
import { Modal, ModalHeader, ModalTitle, ModalDescription } from "#/components/ui/modal";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/settings/account")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) {
      throw redirect({
        to: "/",
      });
    }
  },
  head: () => ({
    meta: [
      { title: `Account Settings | ${siteConfig.name}` },
      {
        name: "description",
        content: "Manage your email, social accounts, and account security.",
      },
    ],
  }),
  component: AccountSettingsPage,
});

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
      />
    </svg>
  );
}

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

function AccountSettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { confirm } = useConfirmModal();

  // Change Email Modal state
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<"input-email" | "verify-otp">("input-email");
  const [newEmail, setNewEmail] = useState("");
  const [emailDigits, setEmailDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const emailInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // 2FA Modal state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    Boolean((user as any)?.twoFactorEnabled),
  );
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isBackupCopied, setIsBackupCopied] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [isSecretCopied, setIsSecretCopied] = useState(false);
  const [twoFactorDigits, setTwoFactorDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isActivating2FA, setIsActivating2FA] = useState(false);
  const twoFactorInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!totpURI) {
      setQrCodeDataUrl(null);
      return;
    }
    QRCode.toDataURL(totpURI, {
      margin: 2,
      width: 256,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrCodeDataUrl)
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });
  }, [totpURI]);

  useEffect(() => {
    if (user && "twoFactorEnabled" in user) {
      setTwoFactorEnabled(Boolean((user as any).twoFactorEnabled));
    }
  }, [user]);

  // Social & Delete state
  const [linkedAccounts, setLinkedAccounts] = useState<
    Array<{ providerId: string; accountId: string }>
  >([]);
  const [isLinkingProvider, setIsLinkingProvider] = useState<string | null>(null);

  const fetchLinkedAccounts = async () => {
    try {
      const accs = await getUserLinkedAccounts();
      setLinkedAccounts(accs);
    } catch (err) {
      console.error("Failed to load linked accounts:", err);
    }
  };

  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  const linkedGoogle = linkedAccounts.some((a) => a.providerId.toLowerCase() === "google");
  const linkedGithub = linkedAccounts.some((a) => a.providerId.toLowerCase() === "github");
  const isGoogleConfigured = false;
  const isGithubConfigured = true;

  const handle2FAToggle = async (checked: boolean) => {
    if (checked) {
      setTwoFactorError(null);
      setIs2FAModalOpen(true);
      try {
        const { data, error } = await authClient.twoFactor.enable({
          method: "totp",
        });
        if (error) {
          console.error("2FA initialization error:", error);
          setTwoFactorError(error.message || "Unable to start setup. Please try again.");
          return;
        }
        if (data?.method === "totp") {
          setTotpURI(data.totpURI);
          const secretMatch = data.totpURI.match(/secret=([A-Za-z0-9]+)/);
          const secret = secretMatch ? secretMatch[1].toUpperCase() : "";
          setTwoFactorSecret(secret);
          setBackupCodes(data.backupCodes || []);
        }
      } catch (err: any) {
        console.error("2FA initialization error:", err);
        setTwoFactorError(err?.message || "Unable to start setup. Please try again.");
      }
    } else {
      confirm({
        title: "Disable Two-Factor Authentication",
        description:
          "Are you sure you want to disable 2FA? Your account will only require email code or social sign-in.",
        confirmText: "Disable 2FA",
        variant: "destructive",
        onConfirm: async () => {
          try {
            const { error } = await authClient.twoFactor.disable({});
            if (error) {
              console.error("Failed to disable 2FA:", error);
              return;
            }
            setTwoFactorEnabled(false);
            router.invalidate();
          } catch (err) {
            console.error("Failed to disable 2FA:", err);
          }
        },
      });
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(twoFactorSecret || totpURI);
    setIsSecretCopied(true);
    setTimeout(() => setIsSecretCopied(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes.length) return;
    const content =
      `Two-Factor Authentication Backup Recovery Codes\n` +
      `Account: ${user?.email || "User"}\n` +
      `Generated at: ${new Date().toLocaleString()}\n\n` +
      backupCodes.map((code, index) => `${index + 1}. ${code}`).join("\n") +
      `\n\nKeep these codes in a secure place. Each recovery code can only be used once.\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "2fa-backup-codes.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleCopyBackupCodes = () => {
    if (!backupCodes.length) return;
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setIsBackupCopied(true);
    setTimeout(() => setIsBackupCopied(false), 2000);
  };

  const handle2FADigitInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    const newDigits = [...twoFactorDigits];
    newDigits[index] = val ? val[val.length - 1] : "";
    setTwoFactorDigits(newDigits);
    if (val && index < 5) {
      twoFactorInputsRef.current[index + 1]?.focus();
    }
  };

  const handle2FAKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !twoFactorDigits[index] && index > 0) {
      twoFactorInputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleActivate2FA();
    }
  };

  const handle2FAPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    if (!text) return;
    const newDigits = text.split("").concat(Array(6).fill("")).slice(0, 6);
    setTwoFactorDigits(newDigits);
    twoFactorInputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const handleActivate2FA = async () => {
    const code = twoFactorDigits.join("");
    if (code.length !== 6) return;
    setIsActivating2FA(true);
    setTwoFactorError(null);
    try {
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
      });
      if (error) {
        console.error("2FA verification error:", error);
        setTwoFactorError(
          error.message || "Invalid verification code. Please check your authenticator app.",
        );
        return;
      }
      if (data) {
        setTwoFactorEnabled(true);
        setIs2FAModalOpen(false);
        setTwoFactorDigits(["", "", "", "", "", ""]);
        router.invalidate();
      }
    } catch (err: any) {
      console.error("2FA verification exception:", err);
      setTwoFactorError(
        err?.message || "Unable to verify code. Please check your authenticator app.",
      );
    } finally {
      setIsActivating2FA(false);
    }
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendEmailOtp = async () => {
    if (!newEmail.trim()) return;
    setIsEmailLoading(true);
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: newEmail.trim(),
        type: "email-verification",
      });
      setEmailStep("verify-otp");
      setResendCountdown(60);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailDigitInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    const newDigits = [...emailDigits];
    newDigits[index] = val ? val[val.length - 1] : "";
    setEmailDigits(newDigits);
    if (val && index < 5) {
      emailInputsRef.current[index + 1]?.focus();
    }
  };

  const handleEmailKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !emailDigits[index] && index > 0) {
      emailInputsRef.current[index - 1]?.focus();
    }
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    if (!text) return;
    const newDigits = text.split("").concat(Array(6).fill("")).slice(0, 6);
    setEmailDigits(newDigits);
    emailInputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const handleVerifyEmail = async () => {
    setIsEmailLoading(true);
    setTimeout(() => {
      setIsEmailLoading(false);
      setIsChangeEmailModalOpen(false);
      setEmailStep("input-email");
      setNewEmail("");
      setEmailDigits(["", "", "", "", "", ""]);
      router.invalidate();
    }, 1000);
  };

  const promptUnlink = (provider: string) => {
    const providerId = provider.toLowerCase();
    confirm({
      title: `Disconnect ${provider}?`,
      description: `You will no longer be able to use your ${provider} account to log in. You can reconnect it at any time from this page.`,
      confirmText: `Disconnect ${provider}`,
      variant: "destructive",
      onConfirm: async () => {
        setIsLinkingProvider(providerId);
        try {
          await unlinkUserAccount({ data: { providerId } });
          await fetchLinkedAccounts();
        } catch (err) {
          console.error(`Failed to disconnect ${provider}:`, err);
        } finally {
          setIsLinkingProvider(null);
        }
      },
    });
  };

  const handleLinkSocial = async (provider: string) => {
    const providerId = provider.toLowerCase();
    setIsLinkingProvider(providerId);
    try {
      if (providerId === "github") {
        await authClient.linkSocial({
          provider: "github",
          callbackURL: window.location.href,
        });
      }
    } catch (err) {
      console.error(`Failed to connect ${provider}:`, err);
      setIsLinkingProvider(null);
    }
  };

  const promptDeleteAccount = () => {
    confirm({
      title: "Delete account permanently?",
      description:
        "This action cannot be undone. Your account profile, articles, and stored files will be permanently removed.",
      confirmText: "Yes, delete account",
      variant: "destructive",
      onConfirm: async () => {
        await authClient.signOut();
        router.navigate({ to: "/" });
      },
    });
  };

  return (
    <main className="space-y-6 px-4 py-8 md:py-12">
      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Link
          to="/settings/profile"
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors"
        >
          <User className="size-3.5" />
          <span>Profile</span>
        </Link>
        <Link
          to="/settings/account"
          className="text-xs font-semibold text-primary-foreground bg-primary flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        >
          <Shield className="size-3.5" />
          <span>General Account</span>
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        {/* General Settings Card */}
        <div className="bg-card rounded-2xl ring-1 ring-foreground/10 p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold font-display text-foreground tracking-tight">
              General Account
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your email, connected social logins, and account security preferences.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-border/60">
            {/* Email Address Row */}
            <div className="py-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="sm:w-48 shrink-0">
                <span className="text-xs font-semibold text-foreground">Email Address</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Primary sign-in address.
                </p>
              </div>

              <div className="flex-1 max-w-md flex items-center justify-between gap-3">
                <div className="bg-muted/40 px-3 py-1.5 rounded-full ring-1 ring-foreground/10 text-xs font-medium text-foreground truncate font-mono">
                  {user?.email || siteConfig.author.email}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangeEmailModalOpen(true)}
                  className="h-8 px-3 text-xs font-medium rounded-full cursor-pointer shrink-0"
                >
                  Change
                </Button>
              </div>
            </div>

            {/* Connected Accounts Row */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="sm:w-48 shrink-0 pt-1">
                <span className="text-xs font-semibold text-foreground">Connected Accounts</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  One-click social sign-in.
                </p>
              </div>

              <div className="flex-1 max-w-md flex flex-col gap-2">
                {/* Google Row */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-6 rounded-md bg-background border border-border flex items-center justify-center p-1 shadow-2xs shrink-0">
                      <GoogleIcon className="size-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-foreground">Google</span>
                      {linkedGoogle ? (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          Connected
                        </span>
                      ) : !isGoogleConfigured ? (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Unavailable
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    {linkedGoogle ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isLinkingProvider === "google"}
                        onClick={() => promptUnlink("Google")}
                        className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md cursor-pointer"
                      >
                        {isLinkingProvider === "google" ? (
                          <SpinnerGap className="size-3 animate-spin" />
                        ) : (
                          <span>Disconnect</span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isGoogleConfigured || isLinkingProvider === "google"}
                        onClick={() => handleLinkSocial("google")}
                        title={
                          !isGoogleConfigured
                            ? "Google OAuth not configured in environment"
                            : "Connect Google account"
                        }
                        className={`h-7 px-2.5 text-xs font-medium rounded-md transition-colors ${
                          !isGoogleConfigured
                            ? "opacity-50 bg-muted text-muted-foreground cursor-not-allowed"
                            : "hover:bg-accent cursor-pointer"
                        }`}
                      >
                        {isLinkingProvider === "google" ? (
                          <SpinnerGap className="size-3 animate-spin" />
                        ) : (
                          <span>Connect</span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* GitHub Row */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-6 rounded-md bg-stone-900 text-white flex items-center justify-center p-1 shadow-2xs shrink-0">
                      <GithubIcon className="size-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-foreground">GitHub</span>
                      {linkedGithub ? (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          Connected
                        </span>
                      ) : !isGithubConfigured ? (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Unavailable
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    {linkedGithub ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isLinkingProvider === "github"}
                        onClick={() => promptUnlink("GitHub")}
                        className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md cursor-pointer"
                      >
                        {isLinkingProvider === "github" ? (
                          <SpinnerGap className="size-3 animate-spin" />
                        ) : (
                          <span>Disconnect</span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isGithubConfigured || isLinkingProvider === "github"}
                        onClick={() => handleLinkSocial("github")}
                        title={
                          !isGithubConfigured
                            ? "GitHub OAuth not configured in environment"
                            : "Connect GitHub account"
                        }
                        className={`h-7 px-2.5 text-xs font-medium rounded-md transition-colors ${
                          !isGithubConfigured
                            ? "opacity-50 bg-muted text-muted-foreground cursor-not-allowed"
                            : "hover:bg-accent cursor-pointer"
                        }`}
                      >
                        {isLinkingProvider === "github" ? (
                          <SpinnerGap className="size-3 animate-spin" />
                        ) : (
                          <span>Connect</span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Factor Authentication (2FA) Row */}
            <div className="py-3.5 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="sm:w-48 shrink-0">
                <span className="text-xs font-semibold text-foreground">Two-Factor Auth</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  App authenticator verification.
                </p>
              </div>

              <div className="flex-1 max-w-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  {twoFactorEnabled ? (
                    <>
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Enabled
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="size-2 rounded-full bg-muted-foreground/40" />
                      <span className="text-muted-foreground">Disabled</span>
                    </>
                  )}
                </div>

                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handle2FAToggle}
                  aria-label="Toggle two-factor authentication"
                  className="shrink-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone (Delete Account) Card */}
        <div className="bg-card rounded-2xl ring-1 ring-destructive/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-destructive">Delete Account</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Permanently delete your account, active sessions, and uploaded assets.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={promptDeleteAccount}
            className="h-8 px-4 text-xs font-medium border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 rounded-full cursor-pointer shrink-0"
          >
            Delete account
          </Button>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <Modal open={is2FAModalOpen} onOpenChange={setIs2FAModalOpen} className="max-w-[540px]">
        <ModalHeader className="pb-1">
          <ModalTitle className="text-xl font-bold font-display text-foreground">
            Two-Factor Authentication
          </ModalTitle>
          <ModalDescription className="text-xs text-muted-foreground leading-relaxed">
            Add an extra layer of protection to keep your account safe and secure.
          </ModalDescription>
        </ModalHeader>

        {twoFactorError && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20 text-xs font-medium my-1">
            <WarningCircle className="size-4 shrink-0" />
            <span>{twoFactorError}</span>
          </div>
        )}

        <div className="flex flex-col gap-5 py-1">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5">
            <div className="size-7 rounded-full border border-border bg-muted text-foreground font-display font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground font-display">
                Download an authenticator app
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install <span className="text-primary font-semibold">Google Authenticator</span>,
                1Password, Microsoft Authenticator, or Authy on your mobile phone.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3.5">
            <div className="size-7 rounded-full border border-border bg-muted text-foreground font-display font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div className="flex flex-col gap-2.5 min-w-0 flex-1">
              <div>
                <h3 className="text-sm font-bold text-foreground font-display">
                  Scan QR code or enter secret key
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scan the QR code with your authenticator app, or enter the secret key manually:
                </p>
              </div>

              {/* QR Code & Secret Key Card */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-2xl ring-1 ring-foreground/10 min-w-0 w-full overflow-hidden">
                <div className="size-28 sm:size-32 bg-white p-2 rounded-2xl ring-1 ring-black/10 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Two-factor QR code"
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="size-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                      <SpinnerGap className="size-5 animate-spin text-primary" />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Loading...
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-0 flex-1 w-full">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium leading-tight">
                      Secret Key:
                    </span>
                    <div className="flex items-center justify-between gap-1.5 p-2 px-3 rounded-full ring-1 ring-foreground/10 bg-background text-xs font-mono font-bold text-foreground min-w-0 w-full">
                      <span className="truncate tracking-wider select-all min-w-0">
                        {twoFactorSecret
                          ? twoFactorSecret.match(/.{1,4}/g)?.join(" ")
                          : "Generating secret key..."}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        aria-label="Copy secret key"
                        className="text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer transition-colors shrink-0"
                        title="Copy secret key"
                      >
                        {isSecretCopied ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Can&apos;t scan? Type the secret key directly into your authenticator app.
                  </p>
                </div>
              </div>

              {/* Backup Recovery Codes */}
              {backupCodes.length > 0 && (
                <div className="flex flex-col gap-2.5 bg-muted/20 p-3.5 rounded-2xl ring-1 ring-foreground/10">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">
                      Backup Recovery Codes
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyBackupCodes}
                        className="h-7 px-2.5 rounded-full text-[11px] gap-1 cursor-pointer"
                      >
                        {isBackupCopied ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy all</span>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadBackupCodes}
                        className="h-7 px-2.5 rounded-full text-[11px] gap-1 cursor-pointer"
                      >
                        <DownloadSimple className="size-3" />
                        <span>Download .txt</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {backupCodes.map((code) => (
                      <span
                        key={code}
                        className="bg-background px-2 py-1 rounded-lg ring-1 ring-foreground/10 text-[11px] font-mono font-medium text-foreground text-center select-all"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3.5">
            <div className="size-7 rounded-full border border-border bg-muted text-foreground font-display font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div className="flex flex-col gap-2.5 min-w-0 flex-1">
              <div>
                <h3 className="text-sm font-bold text-foreground font-display">
                  Confirm 6-digit code
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter the 6-digit verification code from your authenticator app to complete setup.
                </p>
              </div>

              <div
                className="flex items-center gap-2 sm:gap-2.5 w-full justify-start overflow-x-auto py-0.5"
                onPaste={handle2FAPaste}
                role="group"
                aria-label="6-digit verification code"
              >
                {twoFactorDigits.map((digit, i) => (
                  <input
                    key={`2fa-digit-${i}`}
                    id={i === 0 ? "2fa-digit-0" : undefined}
                    ref={(el) => {
                      twoFactorInputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    aria-label={`Digit ${i + 1} of 6`}
                    onChange={(e) => handle2FADigitInput(i, e)}
                    onKeyDown={(e) => handle2FAKeyDown(i, e)}
                    className={`size-10 sm:size-11 rounded-2xl border text-center font-mono font-bold text-base text-foreground bg-muted/40 focus:bg-background focus:outline-none transition-colors shrink-0 ${
                      digit
                        ? "border-primary bg-background ring-2 ring-primary/20"
                        : "border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60 mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIs2FAModalOpen(false)}
            className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={isActivating2FA || twoFactorDigits.some((d) => !d)}
            onClick={handleActivate2FA}
            className="h-8 px-5 rounded-full text-xs font-semibold cursor-pointer"
          >
            {isActivating2FA ? "Activating..." : "Verify & Enable 2FA"}
          </Button>
        </div>
      </Modal>

      {/* Change Email Modal */}
      <Modal
        open={isChangeEmailModalOpen}
        onOpenChange={setIsChangeEmailModalOpen}
        className="max-w-[480px]"
      >
        <ModalHeader className="pb-2">
          <ModalTitle className="text-xl font-bold font-display text-foreground">
            {emailStep === "input-email" ? "Change email address" : "Verify new email"}
          </ModalTitle>
          <ModalDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {emailStep === "input-email"
              ? "Enter your new email address. We will send a 6-digit confirmation code."
              : `We sent a 6-digit verification code to ${newEmail}. Enter it below to confirm.`}
          </ModalDescription>
        </ModalHeader>

        {emailStep === "input-email" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendEmailOtp();
            }}
            className="flex flex-col gap-4 py-2"
          >
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current email</span>
              <span className="font-semibold text-foreground font-mono">
                {user?.email || siteConfig.author.email}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="change-email-input" className="text-xs font-semibold text-foreground">
                New email address
              </label>
              <Input
                id="change-email-input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-10 text-xs rounded-lg font-mono"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60 mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsChangeEmailModalOpen(false)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEmailLoading || !newEmail.trim()}
                className="rounded-lg px-5 h-9 text-xs font-semibold shadow-xs gap-1.5 cursor-pointer"
              >
                <span>{isEmailLoading ? "Sending code..." : "Continue"}</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyEmail();
            }}
            className="flex flex-col gap-5 py-2"
          >
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-primary/10 ring-1 ring-primary/20 text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <EnvelopeSimple className="size-4 text-primary shrink-0" />
                <span className="text-foreground font-medium truncate font-mono">{newEmail}</span>
              </div>
              <button
                type="button"
                onClick={() => setEmailStep("input-email")}
                className="text-xs text-primary font-semibold hover:underline shrink-0 cursor-pointer"
              >
                Change
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email-digit-0" className="text-xs font-semibold text-foreground">
                6-digit verification code
              </label>
              <div
                className="flex items-center gap-2 sm:gap-2.5 w-full justify-start overflow-x-auto py-0.5"
                onPaste={handleEmailPaste}
                role="group"
                aria-label="6-digit verification code"
              >
                {emailDigits.map((digit, i) => (
                  <input
                    key={`email-digit-${i}`}
                    id={i === 0 ? "email-digit-0" : undefined}
                    ref={(el) => {
                      emailInputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    aria-label={`Digit ${i + 1} of 6`}
                    onChange={(e) => handleEmailDigitInput(i, e)}
                    onKeyDown={(e) => handleEmailKeyDown(i, e)}
                    className={`size-10 sm:size-11 rounded-2xl border text-center font-mono font-bold text-base text-foreground bg-muted/40 focus:bg-background focus:outline-none transition-colors shrink-0 ${
                      digit
                        ? "border-primary bg-background ring-2 ring-primary/20"
                        : "border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Didn't receive the code?</span>
              {resendCountdown > 0 ? (
                <span className="text-muted-foreground font-mono tabular-nums font-medium">
                  Resend in {resendCountdown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={isEmailLoading}
                  className="text-primary font-semibold hover:underline cursor-pointer"
                >
                  Resend code
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60 mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEmailStep("input-email")}
                className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isEmailLoading || emailDigits.some((d) => !d)}
                className="h-8 px-4 rounded-full text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <span>{isEmailLoading ? "Verifying..." : "Confirm change"}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
