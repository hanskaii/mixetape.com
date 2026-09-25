import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CalendarPlus,
  LinkSimple,
  SpinnerGap,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Badge } from "#/components/ui/badge";
import { PublishingTabs, selectClassName } from "#/components/layouts/publishing-tabs";
import {
  cancelScheduledPost,
  getPublishData,
  retryFailedPost,
  schedulePost,
} from "#/modules/social/social.fn";
import { uploadMedia } from "#/modules/social/media-upload";
import { siteConfig } from "#/config/site";
import { LEAD_CHOICES } from "#/modules/social/timing";

export const Route = createFileRoute("/(app)/_app/publish/")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) throw redirect({ to: "/" });
  },
  loader: () => getPublishData(),
  head: () => ({ meta: [{ title: `Publish | ${siteConfig.name}` }] }),
  component: PublishPage,
});

const YOUTUBE_CATEGORIES = [
  ["27", "Education"],
  ["22", "People & Blogs"],
  ["24", "Entertainment"],
  ["28", "Science & Technology"],
  ["25", "News & Politics"],
  ["10", "Music"],
  ["20", "Gaming"],
  ["26", "Howto & Style"],
  ["17", "Sports"],
] as const;

const STATUS_STYLE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
  publishing: "secondary",
  uploaded: "secondary",
  published: "default",
  failed: "destructive",
  cancelled: "outline",
};

/** `datetime-local` value for a moment, in the browser's own time zone. */
function localInput(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function PublishPage() {
  const router = useRouter();
  const { accounts, posts } = Route.useLoaderData();
  const active = accounts.filter((account) => account.status === "active");

  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const [source, setSource] = useState<"url" | "file">("url");
  const [mediaUrl, setMediaUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("27");
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [madeForKids, setMadeForKids] = useState(false);
  const [postNow, setPostNow] = useState(false);
  // Minutes the platform gets to process the video before it goes public (see timing.ts).
  const [lead, setLead] = useState(30);
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountName = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const upcoming = posts.filter((post) =>
    ["scheduled", "publishing", "uploaded"].includes(post.status),
  );
  const history = posts.filter((post) => !upcoming.includes(post));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let media = mediaUrl.trim();
      if (source === "file") {
        if (!file) throw new Error("Choose a video file");
        setProgress(0);
        media = await uploadMedia(file, setProgress);
      }
      await schedulePost({
        data: {
          accountId,
          mediaUrl: media,
          caption: description,
          scheduledAt: postNow ? undefined : new Date(when).toISOString(),
          leadMinutes: lead,
          metadata: { title, description, category, privacyStatus: privacy, madeForKids },
        },
      });
      setMediaUrl("");
      setFile(null);
      setTitle("");
      setDescription("");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule the post");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const act = async (action: "cancel" | "retry", id: string) => {
    await (action === "cancel"
      ? cancelScheduledPost({ data: { id } })
      : retryFailedPost({ data: { id } }));
    await router.invalidate();
  };

  if (accounts.length === 0) {
    return (
      <main className="space-y-6 px-4 py-8 md:py-12">
        <PublishingTabs />
        <p className="text-sm text-muted-foreground">
          Connect a channel first on the{" "}
          <Link to="/channels" className="text-foreground underline">
            Channels
          </Link>{" "}
          page.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-8 px-4 py-8 md:py-12">
      <PublishingTabs />

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl p-4 ring-1 ring-foreground/10 md:grid-cols-2"
      >
        <select
          className={selectClassName}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          aria-label="Channel"
          required
        >
          {active.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.provider})
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={source === "url" ? "default" : "outline"}
            onClick={() => setSource("url")}
          >
            <LinkSimple /> URL
          </Button>
          <Button
            type="button"
            size="sm"
            variant={source === "file" ? "default" : "outline"}
            onClick={() => setSource("file")}
          >
            <UploadSimple /> Upload
          </Button>
        </div>

        {source === "url" ? (
          <Input
            className="md:col-span-2"
            type="url"
            placeholder="https://… video URL (e.g. a public R2 object)"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            required
          />
        ) : (
          <Input
            className="md:col-span-2"
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        )}

        <Input
          className="md:col-span-2"
          placeholder="Title"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          className="md:col-span-2 min-h-28"
          placeholder="Description"
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <select
          className={selectClassName}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
        >
          {YOUTUBE_CATEGORIES.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={selectClassName}
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
          aria-label="Visibility"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={postNow} onChange={(e) => setPostNow(e.target.checked)} />
          Post now {lead > 0 && privacy === "public" && `(live in ${lead} min)`}
        </label>
        {!postNow && (
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
            aria-label="Scheduled time"
          />
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-2">
          <span>
            Upload before going live — the post stays editable in mixetape until then, and YouTube
            uses the time to process the HD versions.
          </span>
          <select
            className={selectClassName}
            value={lead}
            onChange={(e) => setLead(Number(e.target.value))}
            aria-label="Upload before going live"
          >
            {LEAD_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0
                  ? "At go-live time (no processing window)"
                  : `${minutes} minutes before`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={madeForKids}
            onChange={(e) => setMadeForKids(e.target.checked)}
          />
          Made for kids
        </label>

        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={busy || !accountId}>
            {busy ? <SpinnerGap className="animate-spin" /> : <CalendarPlus />}
            {postNow ? "Post now" : "Schedule"}
          </Button>
          {progress !== null && (
            <span className="text-xs text-muted-foreground">
              Uploading {Math.round(progress * 100)}%
            </span>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </form>

      <PostList title="Upcoming" posts={upcoming} accountName={accountName} onAct={act} />
      <PostList title="History" posts={history} accountName={accountName} onAct={act} />
    </main>
  );
}

type PostRow = ReturnType<typeof Route.useLoaderData>["posts"][number];

function PostList({
  title,
  posts,
  accountName,
  onAct,
}: {
  title: string;
  posts: PostRow[];
  accountName: Map<string, string>;
  onAct: (action: "cancel" | "retry", id: string) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border/60 rounded-2xl ring-1 ring-foreground/10">
        {posts.map((post) => {
          const metadata = (post.metadata ?? {}) as { title?: string };
          return (
            <li key={post.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {metadata.title ?? post.caption ?? "Untitled"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {accountName.get(post.accountId) ?? "—"} · live{" "}
                  {new Date(post.scheduledAt).toLocaleString()}
                  {post.status === "scheduled" &&
                    (post.leadMinutes ?? 0) > 0 &&
                    ` · uploads ${new Date(new Date(post.scheduledAt).getTime() - (post.leadMinutes ?? 0) * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  {post.status === "uploaded" && " · on YouTube, goes public at that time"}
                </p>
                {post.error && <p className="mt-1 text-xs text-destructive">{post.error}</p>}
              </div>
              <Badge variant={STATUS_STYLE[post.status] ?? "outline"}>{post.status}</Badge>
              {post.platformUrl && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Open on platform"
                  render={<a href={post.platformUrl} target="_blank" rel="noreferrer" />}
                >
                  <ArrowSquareOut />
                </Button>
              )}
              {post.status === "scheduled" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Cancel"
                  onClick={() => onAct("cancel", post.id)}
                >
                  <X />
                </Button>
              )}
              {post.status === "failed" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Retry"
                  onClick={() => onAct("retry", post.id)}
                >
                  <ArrowCounterClockwise />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
