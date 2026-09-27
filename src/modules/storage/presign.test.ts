import { describe, expect, it } from "vitest";
import { presignUrl } from "./presign";

describe("presignUrl", () => {
  it("matches AWS's documented SigV4 query-signing example", async () => {
    // docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = await presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
      expiresIn: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(new URL(url).searchParams.get("X-Amz-Signature")).toBe(
      "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("signs the headers the upload must carry and encodes the key", async () => {
    const url = new URL(
      await presignUrl({
        method: "PUT",
        host: "acct.r2.cloudflarestorage.com",
        path: "/bucket/media/u1/1-my video.mp4",
        accessKeyId: "id",
        secretAccessKey: "secret",
        expiresIn: 3600,
        headers: { "content-type": "video/mp4" },
      }),
    );
    expect(url.pathname).toBe("/bucket/media/u1/1-my%20video.mp4");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
  });
});
