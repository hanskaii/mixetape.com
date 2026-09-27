import type { Caption, CaptionsCapability } from "../types";
import { DATA_API, UPLOAD_API, download, youtubeFetch } from "./api";

/**
 * Subtitle tracks (captions.list 50 units; insert 400, update 450). A track with the same
 * language and name is replaced rather than duplicated, so uploading again is safe.
 */

type Track = {
  id: string;
  snippet?: {
    language?: string;
    name?: string;
    trackKind?: string;
    isDraft?: boolean;
    status?: string;
  };
};

const toCaption = (track: Track): Caption => ({
  id: track.id,
  language: track.snippet?.language ?? "",
  name: track.snippet?.name ?? "",
  kind: track.snippet?.trackKind,
  isDraft: track.snippet?.isDraft,
  status: track.snippet?.status,
});

/** A multipart/related body: the track's JSON, then the subtitle file. */
function multipart(resource: unknown, file: ArrayBuffer) {
  const boundary = `mixetape-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(resource),
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export const youtubeCaptions: CaptionsCapability = {
  async list(videoId, token) {
    const data = await youtubeFetch<{ items?: Track[] }>(token, `${DATA_API}/captions`, {
      query: { part: "snippet", videoId },
    });
    return (data.items ?? []).map(toCaption);
  },

  async put(videoId, { language, name = "", url, isDraft = false }, token) {
    const file = await (await download(url, "caption file")).arrayBuffer();
    // Automatic (ASR) tracks cannot be replaced; only uploaded ones.
    const existing = (await youtubeCaptions.list(videoId, token)).find(
      (track) => track.language === language && track.name === name && track.kind !== "asr",
    );
    const { body, contentType } = multipart(
      existing
        ? { id: existing.id, snippet: { isDraft } }
        : { snippet: { videoId, language, name, isDraft } },
      file,
    );
    const track = await youtubeFetch<Track>(token, `${UPLOAD_API}/captions`, {
      method: existing ? "PUT" : "POST",
      query: { part: "snippet", uploadType: "multipart" },
      headers: { "Content-Type": contentType },
      body,
    });
    return { ...toCaption(track), replaced: Boolean(existing) };
  },
};
