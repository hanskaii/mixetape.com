/**
 * The sidebar's icons: Phosphor glyphs (astro-icon `ph:`), drawn in the text colour so they
 * stay monochrome, platform and agent marks included. Links are keyed by path, groups by
 * label; anything missing here simply has no icon.
 */
const LINKS: Record<string, string> = {
  "/introduction": "ph:book-open",
  "/quickstart": "ph:rocket-launch",
  "/concepts/api-keys": "ph:key",
  "/concepts/library": "ph:folders",
  "/concepts/media": "ph:image",
  "/concepts/posts-and-timing": "ph:calendar-dots",
  "/concepts/webhooks": "ph:webhooks-logo",
  "/agents": "ph:plugs-connected",
  "/agents/claude-code": "ph:asterisk",
  "/agents/codex": "ph:open-ai-logo",
  "/agents/cursor": "ph:cursor",
  "/agents/opencode": "ph:terminal-window",
  "/agents/tools": "ph:wrench",
  "/agents/tips": "ph:sparkle",
  "/rest-api": "ph:code",
  "/api": "ph:books",
  "/platforms/youtube": "ph:youtube-logo",
  "/platforms/facebook": "ph:facebook-logo",
  "/platforms/instagram": "ph:instagram-logo",
  "/platforms/threads": "ph:threads-logo",
  "/platforms/tiktok": "ph:tiktok-logo",
  "/platforms/pinterest": "ph:pinterest-logo",
  "/platforms/bluesky": "ph:butterfly",
  "/platforms/mastodon": "ph:mastodon-logo",
};

const GROUPS: Record<string, string> = {
  Concepts: "ph:lightbulb",
  "Agents (MCP)": "ph:robot",
  "REST API": "ph:brackets-curly",
  Platforms: "ph:squares-four",
};

export const linkIcon = (href: string) => LINKS[href.replace(/\/+$/, "") || "/"];
export const groupIcon = (label: string) => GROUPS[label];
