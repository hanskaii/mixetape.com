import { describe, expect, it } from "vitest";
import { channelUrl } from "./channel-url";

const account = (provider: string, platformAccountId: string, handle: string | null = null) => ({
  provider,
  platformAccountId,
  handle,
});

describe("channelUrl", () => {
  it("links YouTube and Facebook by id", () => {
    expect(channelUrl(account("youtube", "UC123", "@hans"))).toBe(
      "https://www.youtube.com/channel/UC123",
    );
    expect(channelUrl(account("facebook", "1085"))).toBe("https://www.facebook.com/1085");
  });

  it("links username platforms by handle, without the @", () => {
    expect(channelUrl(account("instagram", "1784", "@nurhudai_"))).toBe(
      "https://www.instagram.com/nurhudai_",
    );
    expect(channelUrl(account("threads", "1", "@me"))).toBe("https://www.threads.com/@me");
  });

  it("has no link when the platform only gave an id", () => {
    expect(channelUrl(account("instagram", "1784"))).toBeNull();
    expect(channelUrl(account("tiktok", "open-1", null))).toBeNull();
  });
});
