import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { decrypt } from "./crypto";
import { getProvider, PermanentPublishError } from "./providers";
import type { PlatformMetadata } from "./providers";
import { ServiceError, accessTokenFor, loadForPublishing, updatePost } from "./social.service";

export type PublishParams = { postId: string };

/** How far ahead a post must be for the platform, not us, to hold it until its time. */
const NATIVE_LEAD_MS = 15 * 60 * 1000;

/**
 * Publishes one post. Durable: a deploy, a crash or a Worker restart does not lose it, and
 * it can wait days for its scheduled time without holding anything open.
 *
 *   plan    — read the post; a cancelled or finished one ends here
 *   wait    — only when the platform cannot schedule by itself
 *   publish — refresh the token, upload, record the result (retried with backoff)
 */
export class PublishWorkflow extends WorkflowEntrypoint<Env, PublishParams> {
  async run(event: WorkflowEvent<PublishParams>, step: WorkflowStep) {
    const { postId } = event.payload;

    const plan = await step.do("plan", async () => {
      const loaded = await loadForPublishing(postId);
      if (!loaded) return null;
      const provider = getProvider(loaded.post.provider);
      const scheduledAt = loaded.post.scheduledAt.getTime();
      return {
        status: loaded.post.status,
        scheduledAt,
        native: provider.schedulesNatively && scheduledAt - Date.now() > NATIVE_LEAD_MS,
      };
    });
    if (!plan || plan.status !== "scheduled") return { skipped: plan?.status ?? "missing" };

    if (!plan.native && plan.scheduledAt > Date.now()) {
      await step.sleepUntil("wait until scheduled", new Date(plan.scheduledAt));
    }

    try {
      return await step.do(
        "publish",
        {
          retries: { limit: 4, delay: "2 minutes", backoff: "exponential" },
          timeout: "45 minutes",
        },
        async () =>
          publish(postId, plan.native ? new Date(plan.scheduledAt).toISOString() : undefined),
      );
    } catch (error) {
      // Retries are exhausted, or the error was permanent: the post says why.
      const message = error instanceof Error ? error.message : String(error);
      await step.do("record failure", async () => {
        await updatePost(postId, { status: "failed", error: message.slice(0, 1000) });
      });
      throw error;
    }
  }
}

async function publish(postId: string, publishAt?: string) {
  const loaded = await loadForPublishing(postId);
  if (!loaded) throw new NonRetryableError("The post, its account or its credential was deleted");
  const { post, account, credential } = loaded;
  // A retry after a success must not upload the video twice.
  if (post.status === "cancelled" || post.status === "published" || post.status === "uploaded") {
    return { skipped: post.status };
  }

  await updatePost(postId, { status: "publishing", attempts: post.attempts + 1, error: null });
  const provider = getProvider(post.provider);

  try {
    const accessToken = await accessTokenFor(account, credential);
    const metadata = {
      ...post.metadata,
      ...(publishAt ? { publishAt } : {}),
    } as PlatformMetadata;
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

    await updatePost(postId, {
      // 'uploaded': on the platform and set to go live at scheduledAt by the platform itself.
      status: publishAt ? "uploaded" : "published",
      platformPostId: result.platformPostId ?? null,
      platformUrl: result.platformUrl ?? null,
      publishedAt: publishAt ? post.scheduledAt : new Date(),
      error: null,
    });
    return { status: publishAt ? "uploaded" : "published", platformPostId: result.platformPostId };
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
