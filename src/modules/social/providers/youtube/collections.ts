import type { Collection, CollectionsCapability } from "../types";
import { DATA_API, youtubeFetch } from "./api";

/** The channel's playlists (playlists.list 1 unit per page; insert 50 units each). */

type Playlist = {
  id: string;
  snippet?: { title?: string; description?: string };
  status?: { privacyStatus?: string };
  contentDetails?: { itemCount?: number };
};

const toCollection = (playlist: Playlist): Collection => ({
  id: playlist.id,
  title: playlist.snippet?.title ?? playlist.id,
  description: playlist.snippet?.description || undefined,
  visibility: playlist.status?.privacyStatus,
  itemCount: playlist.contentDetails?.itemCount,
  url: `https://www.youtube.com/playlist?list=${playlist.id}`,
});

const MAX_PAGES = 10;

export const youtubeCollections: CollectionsCapability = {
  async list(token) {
    const playlists: Playlist[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await youtubeFetch<{ items?: Playlist[]; nextPageToken?: string }>(
        token,
        `${DATA_API}/playlists`,
        {
          query: {
            part: "snippet,status,contentDetails",
            mine: true,
            maxResults: 50,
            pageToken,
          },
        },
      );
      playlists.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return playlists.map(toCollection);
  },

  async create(token, { title, description, visibility }) {
    const playlist = await youtubeFetch<Playlist>(token, `${DATA_API}/playlists`, {
      method: "POST",
      query: { part: "snippet,status" },
      body: JSON.stringify({
        snippet: { title, description: description ?? "" },
        status: { privacyStatus: visibility ?? "public" },
      }),
    });
    return toCollection(playlist);
  },

  async add(token, playlistId, videoId, position) {
    await youtubeFetch(token, `${DATA_API}/playlistItems`, {
      method: "POST",
      query: { part: "snippet" },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
          ...(position !== undefined && { position }),
        },
      }),
    });
  },
};
