import { Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ArrowCounterClockwise, ArrowSquareOut, SpinnerGap, X } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { colors } from "../../../../../components/ui/tokens.stylex";
import {
  Empty,
  LocalTime,
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

export type QueueData = Awaited<ReturnType<typeof getQueueData>>;
type Post = QueueData["posts"][number];

const ACTIVE = ["scheduled", "publishing", "uploaded"];

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  scheduled: { label: "Waiting", variant: "outline" },
  publishing: { label: "Uploading", variant: "secondary" },
  uploaded: { label: "On YouTube", variant: "secondary" },
  published: { label: "Live", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const styles = stylex.create({
  summary: { color: colors.mutedForeground, fontSize: "0.8125rem", margin: 0 },
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

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

/**
 * The queue: what agents have scheduled and what went out. Used by the Queue page and,
 * with sample data, by the landing page's workspace preview.
 */
export function QueueView({ accounts, posts }: QueueData) {
  const router = useRouter();
  const { confirm } = useConfirmModal();
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
  const [retrying, setRetrying] = useState<string | null>(null);
  const retry = async (post: Post) => {
    setRetrying(post.id);
    try {
      await retryFailedPost({ data: { id: post.id } });
      await router.invalidate();
    } finally {
      setRetrying(null);
    }
  };

  const row = (post: Post) => {
    const at = new Date(post.scheduledAt);
    const title = (post.metadata as { title?: string } | null)?.title ?? post.caption ?? "Untitled";
    const status = STATUS[post.status] ?? { label: post.status, variant: "outline" as const };
    const lead = post.status === "scheduled" ? (post.leadMinutes ?? 0) : 0;
    return (
      <Row
        key={post.id}
        leading={
          <Mono style={styles.when}>
            <span>
              <LocalTime date={at} format={DAY} />
            </span>
            <span {...stylex.props(styles.whenTime)}>
              <LocalTime date={at} format={TIME} />
            </span>
          </Mono>
        }
        title={title}
        meta={
          <>
            {channel.get(post.accountId) ?? "—"}
            {lead > 0 && (
              <>
                {" · uploads "}
                <LocalTime date={at.getTime() - lead * 60_000} format={TIME} />
              </>
            )}
          </>
        }
        error={post.error}
      >
        <Badge variant={status.variant}>{status.label}</Badge>
        <span {...stylex.props(styles.actions)}>
          {post.platformUrl && post.status !== "cancelled" && (
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
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Retry"
              disabled={retrying === post.id}
              onClick={() => retry(post)}
            >
              {retrying === post.id ? (
                <SpinnerGap className="animate-spin" />
              ) : (
                <ArrowCounterClockwise />
              )}
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

      {posts.length > 0 && (
        <p {...stylex.props(styles.summary)}>
          {count("scheduled")} waiting · {count("uploaded") + count("publishing")} on YouTube ·{" "}
          {count("published")} live · {count("failed")} failed
        </p>
      )}

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
