import type { SocialProvider } from "../types";
import { videoUrl } from "./api";
import { youtubeAnalytics } from "./analytics";
import { youtubeCaptions } from "./captions";
import { youtubeCollections } from "./collections";
import { youtubeComments } from "./comments";
import { youtubeConnect } from "./connect";
import { youtubeMetadata, type YouTubeVideoMeta } from "./metadata";
import { uploadVideo } from "./upload";
import { youtubeEditing, youtubeStatus, youtubeThumbnails } from "./videos";

export type { YouTubeVideoMeta } from "./metadata";

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const youtube: SocialProvider = {
  id: "youtube",
  name: "YouTube",
  schedulesNatively: true,
  // Long videos need time for YouTube to build the HD versions; half an hour covers most.
  defaultLeadMinutes: 30,

  connect: youtubeConnect,
  metadata: youtubeMetadata,
  status: youtubeStatus,
  thumbnails: youtubeThumbnails,
  editing: youtubeEditing,
  collections: youtubeCollections,
  captions: youtubeCaptions,
  comments: youtubeComments,
  analytics: youtubeAnalytics,

  /**
   * Uploads the video, then applies what can only be set on a video that exists — the
   * thumbnail, playlists and captions. The video is up either way, so a follow-up that
   * fails is reported as a warning instead of failing the post.
   */
  async upload(post, token, metadata) {
    const meta = metadata as YouTubeVideoMeta;
    const videoId = await uploadVideo(post.url, post.caption, token, metadata);

    const followUps: { label: string; run: () => Promise<unknown> }[] = [];
    const thumbnailUrl = meta.thumbnailUrl;
    if (thumbnailUrl)
      followUps.push({
        label: "Thumbnail",
        run: () => youtubeThumbnails.set(videoId, thumbnailUrl, token),
      });
    for (const id of meta.playlistIds ?? [])
      followUps.push({
        label: `Playlist ${id}`,
        run: () => youtubeCollections.add(token, id, videoId),
      });
    for (const caption of meta.captions ?? [])
      followUps.push({
        label: `Captions (${caption.language})`,
        run: () => youtubeCaptions.put(videoId, caption, token),
      });

    const warnings: string[] = [];
    for (const { label, run } of followUps) {
      await run().catch((error) => warnings.push(`${label} not set: ${describe(error)}`));
    }
    if (warnings.length) console.warn("[YouTube]", warnings);

    return {
      platformPostId: videoId,
      platformUrl: videoUrl(videoId),
      responseLog: meta.publishAt
        ? `Video uploaded; YouTube publishes it at ${meta.publishAt}`
        : "Video uploaded successfully",
      warning: warnings.join(" · ") || undefined,
    };
  },
};
