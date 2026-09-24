import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  UploadSimple,
  Check,
  WarningCircle,
  User,
  Shield,
  SpinnerGap,
} from "@phosphor-icons/react";
import { authClient } from "#/modules/auth/auth-client";
import { getProfileData, updateProfileData } from "./-fn/profile.fn";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/settings/profile")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) {
      throw redirect({
        to: "/",
      });
    }
  },
  loader: async () => {
    return await getProfileData();
  },
  head: () => ({
    meta: [
      { title: `Profile Settings | ${siteConfig.name}` },
      {
        name: "description",
        content: "Manage your public profile, username handle, and bio.",
      },
    ],
  }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const router = useRouter();
  const { user: initialUser } = Route.useLoaderData();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initialUser?.name || "");
  const [bio, setBio] = useState(initialUser?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialUser?.image || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; error?: string; url?: string };
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || "Failed to upload avatar to R2");
      }

      const uploadedUrl = data.url;
      setAvatarUrl(uploadedUrl);

      await updateProfileData({ data: { image: uploadedUrl } });

      setMessage({ type: "success", text: "Avatar uploaded to R2 and updated!" });
      router.invalidate();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error uploading avatar" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const cleanName = username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      await updateProfileData({
        data: {
          name: cleanName,
          bio: bio.trim(),
          image: avatarUrl,
        },
      });

      setMessage({ type: "success", text: "Profile updated successfully!" });
      router.invalidate();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error saving profile" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="space-y-6 px-4 py-8 md:py-12">
      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Link
          to="/settings/profile"
          className="text-xs font-semibold text-primary-foreground bg-primary flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        >
          <User className="size-3.5" />
          <span>Profile</span>
        </Link>
        <Link
          to="/settings/account"
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors"
        >
          <Shield className="size-3.5" />
          <span>General Account</span>
        </Link>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs font-medium ring-1 ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20"
              : "bg-destructive/10 text-destructive ring-destructive/20"
          }`}
        >
          {message.type === "success" ? (
            <Check className="size-4 shrink-0" />
          ) : (
            <WarningCircle className="size-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
        {/* Profile Details Card */}
        <div className="bg-card rounded-2xl ring-1 ring-foreground/10 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold font-display text-foreground tracking-tight">
                Profile Details
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage your public display name, handle, bio, and profile avatar.
              </p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border/60">
            {/* Avatar Row */}
            <div className="py-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="sm:w-48 shrink-0">
                <label
                  htmlFor="profile-avatar-file"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  Profile Photo
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Your public profile avatar.
                </p>
              </div>

              <div className="flex-1 max-w-md flex items-center gap-4">
                <div className="size-12 rounded-full overflow-hidden bg-muted/60 ring-1 ring-foreground/10 shrink-0 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                  ) : (
                    <div className="size-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {(username || user?.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <input
                    id="profile-avatar-file"
                    aria-label="Upload profile photo"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 text-xs font-medium rounded-full gap-1.5 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <SpinnerGap className="size-3 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadSimple className="size-3 text-muted-foreground" />
                        <span>Change Avatar</span>
                      </>
                    )}
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    JPG, PNG, GIF or WebP. Max 5MB.
                  </span>
                </div>
              </div>
            </div>

            {/* Username / Handle Row */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="sm:w-48 shrink-0 pt-1.5">
                <label htmlFor="profile-username" className="text-xs font-semibold text-foreground">
                  Username Handle
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Unique public profile handle.
                </p>
              </div>

              <div className="flex-1 max-w-md flex flex-col gap-1.5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-muted-foreground font-mono">
                    @
                  </span>
                  <Input
                    id="profile-username"
                    aria-label="Username Handle"
                    required
                    placeholder={siteConfig.author.handle}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-8 h-9 text-xs font-mono rounded-full"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Your profile URL:{" "}
                  <span className="font-mono text-foreground">/@{username || "username"}</span>
                </p>
              </div>
            </div>

            {/* Bio / Summary Row */}
            <div className="py-3.5 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="sm:w-48 shrink-0 pt-1.5">
                <label htmlFor="profile-bio" className="text-xs font-semibold text-foreground">
                  Bio
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  Brief description of yourself.
                </p>
              </div>

              <div className="flex-1 max-w-md flex flex-col gap-1.5">
                <Textarea
                  id="profile-bio"
                  aria-label="Profile Bio"
                  rows={3}
                  placeholder="Tell the world about yourself, your stack, and what you build..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="text-xs leading-relaxed rounded-2xl p-3"
                />
                <span className="text-[10px] text-muted-foreground">
                  Markdown and plain text supported.
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-border/60 mt-1">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="h-8 px-4 text-xs font-semibold rounded-full cursor-pointer gap-1.5"
            >
              {isSaving ? (
                <>
                  <SpinnerGap className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
