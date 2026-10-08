import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { cancelScheduledPost, retryFailedPost } from "#/modules/social/social.fn";
import { PUBLISH_KEY } from "../-fn/calendar.fn";
import type { Post } from "../-lib/posts";

/** Cancel and retry from the list or the calendar; both refresh whichever is showing. */
export function usePostActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm } = useConfirmModal();
  const [retrying, setRetrying] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([router.invalidate(), queryClient.invalidateQueries({ queryKey: PUBLISH_KEY })]);

  const cancel = (post: Post) =>
    confirm({
      title: "Cancel this post?",
      description: "It will not be uploaded. Your agent can schedule it again.",
      confirmText: "Cancel post",
      variant: "destructive",
      onConfirm: async () => {
        await cancelScheduledPost({ data: { id: post.id } });
        await refresh();
      },
    });

  const retry = async (post: Post) => {
    setRetrying(post.id);
    try {
      await retryFailedPost({ data: { id: post.id } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry the post");
    } finally {
      setRetrying(null);
    }
  };

  return { cancel, retry, retrying };
}
