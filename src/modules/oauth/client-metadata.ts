/**
 * The fetch the CIMD plugin uses to read an MCP client's metadata document (its client_id
 * is that document's https URL). A Worker cannot reach private networks, so what is left
 * is refusing what could point there or bounce elsewhere: only https, no IP literals, no
 * redirects, a short timeout and a small body.
 */

const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;

const isIpLiteral = (hostname: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[");

export async function fetchClientMetadataResource(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.protocol !== "https:" || isIpLiteral(url.hostname) || url.hostname === "localhost")
    throw new Error(`Refused to fetch client metadata from ${url.origin}`);

  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error("Client metadata documents must not redirect");

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new Error("The client metadata document is too large");
  return new Response(body, { status: response.status, headers: response.headers });
}
