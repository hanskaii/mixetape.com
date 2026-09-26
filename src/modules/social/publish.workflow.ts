import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { decrypt } from "./crypto";
import { getProvider, PermanentPublishError } from "./providers";
import type { PlatformMetadata } from "./providers";
import {
  ServiceError,
  accessTokenFor,
  loadForPublishing,
  platformStatusFor,
  updatePost,
} from "./social.service";
import { publishTiming } from "./timing";

export type PublishParams = { postId: string };

/**
 * Publishes one post, the way Buffer does: the post waits in mixetape — editable, movable,
 * cancellable — until shortly before its time, and only then goes to the platform.
 * Durable: a deploy, a crash or a Worker restart does not lose it, and it can wait days
 * without holding anything open.
 *
 *   plan    — read the post; a cancelled, finished or superseded one ends here
 *   wait    — in mixetape, until `leadMinutes` before go-live (see timing.ts)
 *   publish — refresh the token and upload; a platform that can hold it (YouTube) gets
 *             publishAt, and processes the high-quality versions while it waits
 *   confirm — after go-live, check the platform really made it public
 */
export class PublishWorkflow extends WorkflowEntrypoint<Env, PublishParams> {
  async run(event: WorkflowEvent<PublishParams>, step: WorkflowStep) {
    const { postId } = event.payload;

    const plan = await step.do("plan", async () => {
      const loaded = await loadForPublishing(postId);
      if (!loaded) return null;
      // A reschedule or retry hands the post to a newer instance; this one steps aside.
      if (loaded.post.workflowId && loaded.post.workflowId !== event.instanceId) {
        return { status: "superseded", scheduledAt: 0, uploadAt: 0 };
      }
      const provider = getProvider(loaded.post.provider);
      const scheduledAt = loaded.post.scheduledAt.getTime();
      const { uploadAt } = publishTiming({
        scheduledAt,
        leadMinutes: loaded.post.leadMinutes ?? provider.defaultLeadMinutes,
        native: provider.schedulesNatively,
        privacy: (loaded.post.metadata as { privacyStatus?: string } | null)?.privacyStatus,
        now: Date.now(),
      });
      return { status: loaded.post.status, scheduledAt, uploadAt };
    });
    if (!plan || plan.status !== "scheduled") return { skipped: plan?.status ?? "missing" };

    if (plan.uploadAt > Date.now()) {
      await step.sleepUntil("wait in mixetape", new Date(plan.uploadAt));
    }

    let result: Awaited<ReturnType<typeof publish>>;
    try {
      result = await step.do(
        "publish",
        {
          retries: { limit: 4, delay: "2 minutes", backoff: "exponential" },
          timeout: "45 minutes",
        },
        async () => publish(postId, event.instanceId),
      );
    } catch (error) {
      // Retries are exhausted, or the error was permanent: the post says why.
      const message = error instanceof Error ? error.message : String(error);
      await step.do("record failure", async () => {
        await updatePost(postId, { status: "failed", error: message.slice(0, 1000) });
      });
      throw error;
    }

    // Held by the platform until go-live: once that has passed, confirm it went public.
    if (result.status === "uploaded" && result.publishAt) {
      await step.sleepUntil(
        "wait for go-live",
        new Date(new Date(result.publishAt).getTime() + 2 * 60_000),
      );
      try {
        await step.do(
          "confirm live",
          { retries: { limit: 6, delay: "5 minutes", backoff: "linear" } },
          async () => {
            const status = await platformStatusFor(postId);
            if (status && status.visibility !== "public") {
              throw new Error(
                `still ${status.visibility ?? "not public"}${status.problem ? ` — ${status.problem}` : ""}`,
              );
            }
            await updatePost(postId, { status: "published", publishedAt: new Date(), error: null });
          },
        );
      } catch (error) {
        // The video is on the platform either way; say why it is not live rather than fail.
        const message = error instanceof Error ? error.message : String(error);
        await step.do("record not live", async () => {
          await updatePost(postId, {
            error: `Uploaded, but the platform has not made it public: ${message}`.slice(0, 1000),
          });
        });
      }
    }
    return result;
  }
}

async function publish(
  postId: string,
  instanceId: string,
): Promise<{ status: string; platformPostId?: string; publishAt?: string }> {
  const loaded = await loadForPublishing(postId);
  if (!loaded) throw new NonRetryableError("The post, its account or its credential was deleted");
  const { post, account, credential } = loaded;
  // A retry after a success must not upload the video twice, and an instance that is no
  // longer the post's owner (it was rescheduled or retried) must not upload it at all.
  if (post.workflowId && post.workflowId !== instanceId) return { status: "superseded" };
  if (post.status === "cancelled" || post.status === "published" || post.status === "uploaded") {
    return { status: post.status };
  }

  const provider = getProvider(post.provider);
  // Worked out now, not when planned: the post may have been edited while it waited, and a
  // late wake-up must not hand the platform a publishAt in the past.
  const { publishAt } = publishTiming({
    scheduledAt: post.scheduledAt.getTime(),
    leadMinutes: post.leadMinutes ?? provider.defaultLeadMinutes,
    native: provider.schedulesNatively,
    privacy: (post.metadata as { privacyStatus?: string } | null)?.privacyStatus,
    now: Date.now(),
  });

  await updatePost(postId, { status: "publishing", attempts: post.attempts + 1, error: null });

  try {
    const accessToken = await accessTokenFor(account, credential);
    const metadata = { ...post.metadata, ...(publishAt ? { publishAt } : {}) } as PlatformMetadata;
    const result = await provider.upload(
      {
        ...post,
        url: post.mediaUrl,
        caption: post.caption,
        platformAccountId: account.platformAccountId,
      },
      accessToken,
      credential.clientId,
      await decrypt(credential.clientSecret),
      metadata,
    );

    const status = publishAt ? "uploaded" : "published";
    await updatePost(postId, {
      // 'uploaded': on the platform, private until it publishes it at scheduledAt.
      status,
      platformPostId: result.platformPostId ?? null,
      platformUrl: result.platformUrl ?? null,
      publishedAt: publishAt ? null : new Date(),
      error: result.warning ?? null,
    });
    return { status, platformPostId: result.platformPostId, publishAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const permanent =
      error instanceof PermanentPublishError ||
      (error instanceof ServiceError && error.status === 409) ||
      message === "YOUTUBE_QUOTA_EXCEEDED";
    const friendly =
      message === "YOUTUBE_QUOTA_EXCEEDED"
        ? "YouTube's daily upload quota for this Google app is used up. Retry after it resets (midnight Pacific time)."
        : message;
    await updatePost(postId, {
      status: permanent ? "failed" : "scheduled",
      error: friendly.slice(0, 1000),
    });
    if (permanent) throw new NonRetryableError(friendly);
    throw error;
  }
}
