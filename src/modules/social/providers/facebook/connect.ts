import type { ConnectCapability, ConnectedAccount } from "../types";
import { metaAuthorizeUrl, metaLogin, pageGrant, refreshPageToken } from "../meta/login";

/**
 * Facebook Login for Pages. People can only publish to Pages through the API (never to a
 * personal profile), so each Page the person manages becomes one account with its own
 * non-expiring Page access token.
 */
const SCOPES = {
  pages_show_list: "see the Pages you manage",
  pages_read_engagement: "read your Pages' posts",
  pages_manage_posts: "publish to your Pages",
  pages_manage_engagement: "answer and moderate comments",
  pages_read_user_content: "read comments on your Pages",
  read_insights: "read your Pages' insights",
  // Part of the "Manage everything on your Page" use case; lets Pages owned through a
  // business portfolio show up in /me/accounts.
  business_management: "reach Pages in your business portfolio",
} as const;

export const facebookConnect: ConnectCapability = {
  scopes: Object.keys(SCOPES),

  authorizeUrl: (input) => metaAuthorizeUrl(Object.keys(SCOPES), input),

  async exchangeCode(app, input) {
    const { user, granted, pages } = await metaLogin(
      app,
      input,
      SCOPES,
      "id,name,username,access_token,tasks,picture{url}",
    );
    const accounts: ConnectedAccount[] = pages
      .filter((page) => page.access_token && (page.tasks ?? []).includes("CREATE_CONTENT"))
      .map((page) => ({
        platformAccountId: page.id,
        name: page.name,
        handle: page.username ? `@${page.username}` : undefined,
        avatar: page.picture?.data?.url,
        grant: pageGrant(page.access_token!, granted),
      }));
    if (!accounts.length) {
      throw new Error(
        "This Facebook account does not manage a Page it can post to. Publishing goes to Pages only (not personal profiles); pick the Pages when Facebook asks, or get the Create content task on one.",
      );
    }
    return { grant: user, accounts };
  },

  refresh: (_app, pageToken) => refreshPageToken(pageToken),
};
