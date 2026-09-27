/**
 * AWS Signature Version 4 query signing ("presigned URLs"), which R2's S3 API accepts. A
 * presigned URL lets whoever holds it make one kind of request until it expires, with no
 * other credentials — here, a PUT of one file straight into the bucket.
 */

const encoder = new TextEncoder();

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

/** RFC 3986 encoding, as SigV4 wants it (encodeURIComponent leaves !'()* alone). */
const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export type PresignInput = {
  method: "GET" | "PUT";
  host: string;
  /** e.g. "/bucket/path/to/key"; each segment is encoded here. */
  path: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Seconds, at most 7 days. */
  expiresIn: number;
  region?: string;
  /** Headers the request must carry exactly, lower-case names (host is always signed). */
  headers?: Record<string, string>;
  now?: Date;
};

export async function presignUrl(input: PresignInput): Promise<string> {
  const region = input.region ?? "auto";
  const amzDate = (input.now ?? new Date()).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;

  const headers = { host: input.host, ...input.headers };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encode(key)}=${encode(query[key])}`)
    .join("&");
  const canonicalPath = input.path.split("/").map(encode).join("/");

  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery,
    names.map((name) => `${name}:${headers[name as keyof typeof headers]!.trim()}\n`).join(""),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest))),
  ].join("\n");

  let key = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), day);
  for (const part of [region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));

  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
