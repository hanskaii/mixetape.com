/**
 * Where a connected channel lives on its platform, or null when mixetape cannot tell (a
 * TikTok account is known only by its open_id, which has no public URL).
 */
export function channelUrl(account: {
  provider: string;
  platformAccountId: string;
  handle: string | null;
}): string | null {
  const id = encodeURIComponent(account.platformAccountId);
  const name = account.handle ? encodeURIComponent(account.handle.replace(/^@/, "")) : null;
  switch (account.provider) {
    case "youtube":
      return `https://www.youtube.com/channel/${id}`;
    case "facebook":
      return `https://www.facebook.com/${id}`;
    case "instagram":
      return name && `https://www.instagram.com/${name}`;
    case "threads":
      return name && `https://www.threads.com/@${name}`;
    case "pinterest":
      return name && `https://www.pinterest.com/${name}`;
    case "bluesky":
      return `https://bsky.app/profile/${id}`;
    case "mastodon": {
      // @user@server: the profile lives on the account's own server.
      const [user, server] = (account.handle ?? "").replace(/^@/, "").split("@");
      return user && server ? `https://${server}/@${encodeURIComponent(user)}` : null;
    }
    default:
      return null;
  }
}
