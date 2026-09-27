import type { ConnectCapability, ConnectedAccount } from "../types";
import { metaAuthorizeUrl, metaLogin, pageGrant, refreshPageToken } from "../meta/login";

/**
 * Instagram through Facebook Login (the same Meta app as Facebook). A professional
 * Instagram account (Business or Creator) linked to a Facebook Page becomes one account;
 * it is reached with that Page's non-expiring token.
 */
const SCOPES = {
  instagram_basic: "see your Instagram accounts",
  instagram_content_publish: "publish to Instagram",
  instagram_manage_comments: "answer and moderate Instagram comments",
  instagram_manage_insights: "read Instagram insights",
  pages_show_list: "see the Pages your Instagram accounts are linked to",
  pages_read_engagement: "read those Pages",
  business_management: "reach accounts in your business portfolio",
} as const;

export const instagramConnect: ConnectCapability = {
  scopes: Object.keys(SCOPES),

  authorizeUrl: (input) => metaAuthorizeUrl(Object.keys(SCOPES), input),

  async exchangeCode(app, input) {
    const { user, granted, pages } = await metaLogin(
      app,
      input,
      SCOPES,
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
    );
    const accounts: ConnectedAccount[] = pages.flatMap((page) => {
      const ig = page.instagram_business_account;
      if (!ig || !page.access_token) return [];
      return [
        {
          platformAccountId: ig.id,
          name: ig.name || ig.username || page.name,
          handle: ig.username ? `@${ig.username}` : undefined,
          avatar: ig.profile_picture_url,
          grant: pageGrant(page.access_token, granted),
        },
      ];
    });
    if (!accounts.length) {
      throw new Error(
        "No Instagram professional account was found. Switch the Instagram account to Business or Creator, link it to a Facebook Page, and pick that Page when Facebook asks.",
      );
    }
    return { grant: user, accounts };
  },

  refresh: (_app, pageToken) => refreshPageToken(pageToken),
};
