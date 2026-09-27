import * as stylex from "@stylexjs/stylex";
import { WorkspaceLayout } from "#/components/layouts/workspace-layout";
import { QueueView, type QueueData } from "../../(app)/_app/queue/-components/queue-view";
import { colors } from "../../../components/ui/tokens.stylex";

/**
 * The real workspace — the same layout and Queue view people use — rendered with sample
 * data. It is a picture: `inert` keeps it out of the tab order and the accessibility tree,
 * and the caption below says it is an example.
 */

const created = new Date("2026-09-20T09:00:00Z");

const account = (id: string, name: string, handle: string): QueueData["accounts"][number] => ({
  id,
  userId: "sample",
  credentialId: "sample-credential",
  provider: "youtube",
  platformAccountId: `UC-${id}`,
  name,
  handle,
  avatar: null,
  accessTokenExpiresAt: null,
  scopes: null,
  status: "active",
  createdAt: created,
  updatedAt: created,
});

const post = (
  id: string,
  accountId: string,
  title: string,
  scheduledAt: string,
  status: string,
  error: string | null = null,
): QueueData["posts"][number] => ({
  id,
  userId: "sample",
  accountId,
  provider: "youtube",
  mediaUrl: "r2://sample.mp4",
  caption: null,
  metadata: { title },
  scheduledAt: new Date(scheduledAt),
  status,
  platformPostId: status === "scheduled" ? null : `v-${id}`,
  platformUrl: status === "scheduled" ? null : "https://www.youtube.com/",
  error,
  attempts: 1,
  workflowId: id,
  leadMinutes: 30,
  publishedAt: null,
  createdAt: created,
  updatedAt: created,
});

const SAMPLE: QueueData = {
  accounts: [
    account("hans", "Hans Explainer", "@hansexplainer"),
    account("nowhere", "Now Where", "@nowwhere"),
    account("memoria", "Memoria", "@memoria.id"),
  ],
  posts: [
    post(
      "p1",
      "nowhere",
      "The Town That Moved Five Kilometres Uphill",
      "2026-10-02T10:00:00Z",
      "uploaded",
    ),
    post("p2", "hans", "You Are Not Broken At 3 A.M.", "2026-10-02T10:30:00Z", "scheduled"),
    post(
      "p3",
      "hans",
      "You Are Not Broken At 3 A.M. — Short 1",
      "2026-10-03T04:30:00Z",
      "scheduled",
    ),
    post("p4", "memoria", "Kisah Radio Terakhir di Kota Tua", "2026-10-04T12:00:00Z", "scheduled"),
    post("p5", "hans", "The Quiet Science of Boredom", "2026-09-25T10:30:00Z", "published"),
    post(
      "p6",
      "nowhere",
      "Where The Rivers Go At Night — Short 3",
      "2026-09-24T12:30:00Z",
      "failed",
      "YouTube's daily upload quota for this Google app is used up. Retry after it resets (midnight Pacific time).",
    ),
  ],
};

const styles = stylex.create({
  figure: { margin: 0 },
  frame: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 18px 48px -40px rgba(35, 25, 8, 0.35)",
    marginInlineStart: { default: 0, "@media (min-width: 1024px)": "1rem" },
    padding: "0.5rem",
  },
  // The workspace fills a viewport of its own; this window shows the top of it. `contain`
  // keeps the layout's fixed and sticky parts inside the window.
  window: {
    borderColor: colors.border,
    borderRadius: "16px",
    borderStyle: "solid",
    borderWidth: "1px",
    contain: "strict",
    height: { default: "40rem", "@media (min-width: 1024px)": "46rem" },
    // Fades out instead of cutting a row in half: there is more queue below.
    maskImage: "linear-gradient(to bottom, #000 88%, transparent)",
    overflow: "hidden",
    pointerEvents: "none",
    userSelect: "none",
  },
  caption: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    marginBlockEnd: 0,
    marginBlockStart: "0.75rem",
    marginInlineStart: { default: "0.5rem", "@media (min-width: 1024px)": "1.5rem" },
  },
});

export function WorkspacePreview() {
  return (
    <figure {...stylex.props(styles.figure)}>
      <div {...stylex.props(styles.frame)}>
        <div inert {...stylex.props(styles.window)}>
          <WorkspaceLayout defaultOpen activePath="/queue" preview>
            <QueueView {...SAMPLE} />
          </WorkspaceLayout>
        </div>
      </div>
      <figcaption {...stylex.props(styles.caption)}>
        The workspace with sample data. Yours shows the channels you connect and what your agents
        schedule, with cancel and retry.
      </figcaption>
    </figure>
  );
}
