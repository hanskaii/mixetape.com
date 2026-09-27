import { graph } from "../meta/graph";

/** The Threads API: Meta's Graph conventions on its own host, token passed as a param. */

export const THREADS = "https://graph.threads.net/v1.0";

type Params = Record<string, string | number | boolean | undefined>;

export function threads<T>(
  token: string,
  path: string,
  { method = "GET", params = {} }: { method?: "GET" | "POST"; params?: Params } = {},
): Promise<T> {
  return graph<T>(token, `${THREADS}/${path.replace(/^\//, "")}`, {
    method,
    params: { ...params, access_token: token },
  });
}
