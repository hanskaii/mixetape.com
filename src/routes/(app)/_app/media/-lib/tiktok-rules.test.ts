import { describe, expect, it } from "vitest";
import {
  NO_DISCLOSURE,
  sharedPrivacy,
  tiktokConsent,
  tiktokProblem,
  type TikTokCreators,
} from "../-lib/tiktok-rules";

const creator = (over: Partial<TikTokCreators[number]> = {}): TikTokCreators[number] => ({
  accountId: "a1",
  name: "Hans",
  nickname: "Hans",
  username: "hans",
  avatarUrl: null,
  privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
  commentDisabled: false,
  duetDisabled: false,
  stitchDisabled: false,
  maxVideoPostDurationSec: 600,
  blocked: null,
  ...over,
});
const check = (
  values: Record<string, unknown>,
  extra: Partial<Parameters<typeof tiktokProblem>[0]> = {},
) =>
  tiktokProblem({
    creators: [creator()],
    loading: false,
    values: values as never,
    disclose: false,
    videoMs: 30_000,
    ...extra,
  });

describe("TikTok's Direct Post rules", () => {
  it("waits for the creator info, and stops an account TikTok will not take a post from", () => {
    expect(check({}, { loading: true })).toMatch(/Checking/);
    expect(
      check({ privacyLevel: "SELF_ONLY" }, { creators: [creator({ blocked: "Try later." })] }),
    ).toMatch(/Try later/);
  });

  it("has no privacy chosen for the person, and offers only what every account allows", () => {
    expect(check({})).toMatch(/Choose who can watch/);
    expect(
      sharedPrivacy([
        creator(),
        creator({ privacyLevelOptions: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] }),
      ]),
    ).toEqual(["PUBLIC_TO_EVERYONE", "SELF_ONLY"]);
    expect(check({ privacyLevel: "PUBLIC_TO_EVERYONE" })).toBeNull();
  });

  it("asks what the content promotes once the disclosure is on", () => {
    expect(check({ privacyLevel: "PUBLIC_TO_EVERYONE" }, { disclose: true })).toBe(NO_DISCLOSURE);
    expect(
      check({ privacyLevel: "PUBLIC_TO_EVERYONE", brandOrganic: true }, { disclose: true }),
    ).toBeNull();
  });

  it("never lets branded content be private", () => {
    expect(check({ privacyLevel: "SELF_ONLY", brandContent: true }, { disclose: true })).toMatch(
      /cannot be set to private/,
    );
  });

  it("refuses a video longer than the account may post", () => {
    expect(
      check(
        { privacyLevel: "SELF_ONLY" },
        { creators: [creator({ maxVideoPostDurationSec: 60 })], videoMs: 61_000 },
      ),
    ).toMatch(/longer than 1 min 0 s/);
  });

  it("words the consent by what is disclosed", () => {
    expect(tiktokConsent({})).toBe("By posting, you agree to TikTok's Music Usage Confirmation.");
    expect(tiktokConsent({ brandContent: true })).toBe(
      "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.",
    );
  });
});
