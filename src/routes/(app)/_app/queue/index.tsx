import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import * as stylex from "@stylexjs/stylex";
import { ArrowCounterClockwise, ArrowSquareOut, X } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { colors } from "../../../../components/ui/tokens.stylex";
import {
  Empty,
  Mono,
  Notice,
  Page,
  PageHeader,
  Panel,
  Row,
  Rows,
} from "#/components/layouts/workspace-page";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { cancelScheduledPost, getQueueData, retryFailedPost } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(app)/_app/queue/")({
  loader: () => getQueueData(),
  head: () => ({ meta: [{ title: `Queue | ${siteConfig.name}` }] }),
  component: QueuePage,
});

type Post = ReturnType<typeof Route.useLoaderData>["posts"][number];

const ACTIVE = ["scheduled", "publishing", "uploaded"];

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  scheduled: { label: "Waiting", variant: "outline" },
  publishing: { label: "Uploading", variant: "secondary" },
  uploaded: { label: "On YouTube", variant: "secondary" },
  published: { label: "Live", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const styles = stylex.create({
  stats: {
    display: "grid",
    gap: "0.5rem",
    gridTemplateColumns: {
      default: "repeat(2, 1fr)",
      "@media (min-width: 768px)": "repeat(4, 1fr)",
    },
  },
  stat: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "0.75rem",
    borderStyle: "solid",
    borderWidth: "1px",
    paddingBlock: "0.625rem",
    paddingInline: "0.875rem",
  },
  statValue: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.03em", margin: 0 },
  statLabel: { color: colors.mutedForeground, fontSize: "0.72rem", margin: 0 },
  when: {
    color: colors.mutedForeground,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    lineHeight: 1.3,
    textAlign: "end",
    width: "3.5rem",
  },
  whenTime: { color: colors.foreground, fontWeight: 600 },
  actions: { display: "flex", gap: "0.125rem" },
  link: { color: colors.foreground, textDecoration: "underline" },
});

const day = (date: Date) => date.toLocaleDateString([], { day: "numeric", month: "short" });
const time = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function QueuePage() {
  const router = useRouter();
  const { confirm } = useConfirmModal();
  const { accounts, posts } = Route.useLoaderData();
  const channel = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name.trim()])),
    [accounts],
  );

  // Upcoming soonest first; history most recent first (as loaded).
  const upcoming = posts
    .filter((post) => ACTIVE.includes(post.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const history = posts.filter((post) => !ACTIVE.includes(post.status)).slice(0, 50);
  const count = (status: string) => posts.filter((post) => post.status === status).length;

  const cancel = (post: Post) =>
    confirm({
      title: "Cancel this post?",
      description: "It will not be uploaded. Your agent can schedule it again.",
      confirmText: "Cancel post",
      variant: "destructive",
      onConfirm: async () => {
        await cancelScheduledPost({ data: { id: post.id } });
        await router.invalidate();
      },
    });
  const retry = async (post: Post) => {
    await retryFailedPost({ data: { id: post.id } });
    await router.invalidate();
  };

  const row = (post: Post) => {
    const at = new Date(post.scheduledAt);
    const title = (post.metadata as { title?: string } | null)?.title ?? post.caption ?? "Untitled";
    const status = STATUS[post.status] ?? { label: post.status, variant: "outline" as const };
    const uploadsAt =
      post.status === "scheduled" && (post.leadMinutes ?? 0) > 0
        ? ` · uploads ${time(new Date(at.getTime() - (post.leadMinutes ?? 0) * 60_000))}`
        : "";
    return (
      <Row
        key={post.id}
        leading={
          <Mono style={styles.when}>
            <span>{day(at)}</span>
            <span {...stylex.props(styles.whenTime)}>{time(at)}</span>
          </Mono>
        }
        title={title}
        meta={`${channel.get(post.accountId) ?? "—"}${uploadsAt}`}
        error={post.error}
      >
        <Badge variant={status.variant}>{status.label}</Badge>
        <span {...stylex.props(styles.actions)}>
          {post.platformUrl && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open on YouTube"
              render={<a href={post.platformUrl} target="_blank" rel="noreferrer" />}
            >
              <ArrowSquareOut />
            </Button>
          )}
          {post.status === "scheduled" && (
            <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => cancel(post)}>
              <X />
            </Button>
          )}
          {post.status === "failed" && (
            <Button size="icon-sm" variant="ghost" aria-label="Retry" onClick={() => retry(post)}>
              <ArrowCounterClockwise />
            </Button>
          )}
        </span>
      </Row>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Queue"
        description="What your agents have scheduled, and what already went out."
      />

      {accounts.length === 0 && (
        <Notice>
          No channel yet —{" "}
          <Link to="/channels" {...stylex.props(styles.link)}>
            connect one
          </Link>
          , then give your agent an{" "}
          <Link to="/api-keys" {...stylex.props(styles.link)}>
            API key
          </Link>
          .
        </Notice>
      )}

      <div {...stylex.props(styles.stats)}>
        {[
          ["Waiting", count("scheduled")],
          ["On YouTube", count("uploaded") + count("publishing")],
          ["Live", count("published")],
          ["Failed", count("failed")],
        ].map(([label, value]) => (
          <div key={label} {...stylex.props(styles.stat)}>
            <p {...stylex.props(styles.statValue)}>{value}</p>
            <p {...stylex.props(styles.statLabel)}>{label}</p>
          </div>
        ))}
      </div>

      <Panel title="Upcoming" count={upcoming.length}>
        {upcoming.length ? (
          <Rows>{upcoming.map(row)}</Rows>
        ) : (
          <Empty>
            Nothing waiting. Agents schedule posts through MCP or the API — see{" "}
            <Link to="/api-keys" {...stylex.props(styles.link)}>
              API keys
            </Link>
            .
          </Empty>
        )}
      </Panel>

      {history.length > 0 && (
        <Panel title="History" count={history.length}>
          <Rows>{history.map(row)}</Rows>
        </Panel>
      )}
    </Page>
  );
}
