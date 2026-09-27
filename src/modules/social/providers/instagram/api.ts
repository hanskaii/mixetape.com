import { GRAPH_VERSION, graph } from "../meta/graph";

/**
 * The Instagram API with Instagram Login: Meta's Graph conventions on Instagram's own host,
 * with the account's Instagram token (not a Facebook Page's).
 */

export const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;

type Params = Record<string, string | number | boolean | undefined>;

export function ig<T>(
  token: string,
  path: string,
  { method = "GET", params = {} }: { method?: "GET" | "POST"; params?: Params } = {},
): Promise<T> {
  return graph<T>(token, `${IG_GRAPH}/${path.replace(/^\//, "")}`, {
    method,
    params: { ...params, access_token: token },
  });
}
