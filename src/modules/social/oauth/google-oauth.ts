// Adapted from clean/oauth/google-oauth.ts — stateful AuthFlow class for Google/YouTube OAuth 2.0

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type GoogleUser = {
  id: string;
  email: string;
  name: string;
  picture: string;
};

export type YouTubeChannel = {
  id: string;
  title: string;
  customUrl?: string;
  thumbnail?: string;
};

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GoogleErrorResponse = {
  error?: string;
  error_description?: string;
};

export class GoogleAuthFlow {
  private token?: { value: string; expiresIn: number };
  refreshToken?: string;
  grantedScopes?: string[];
  user?: GoogleUser;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly state: string,
    private code?: string,
  ) {}

  redirect(): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: GOOGLE_SCOPES.join(" "),
      state: this.state,
      access_type: "offline",
      // Without consent Google only returns a refresh token the first time, and a
      // reconnect would leave the account unable to post once the access token expires.
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async getTokenFromCode(): Promise<void> {
    if (!this.code) throw new Error("No authorization code provided");

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: this.code,
        grant_type: "authorization_code",
      }),
    });

    const data = (await res.json()) as GoogleTokenResponse | GoogleErrorResponse;

    if ("error" in data) {
      throw new Error(`Google OAuth error: ${data.error_description ?? data.error}`);
    }

    if ("access_token" in data) {
      this.token = {
        value: data.access_token,
        expiresIn: data.expires_in,
      };
      this.refreshToken = data.refresh_token;
      this.grantedScopes = data.scope.split(" ");
    }
  }

  async getUserData(): Promise<void> {
    await this.getTokenFromCode();

    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${this.token!.value}` },
    });

    const data = (await res.json()) as GoogleUser | GoogleErrorResponse;

    if ("error" in data) {
      throw new Error(`Google userinfo error: ${data.error_description ?? data.error}`);
    }

    if ("id" in data) this.user = data;
  }

  /** The YouTube channel(s) the signed-in identity owns — the ones videos are uploaded to. */
  async getChannels(): Promise<YouTubeChannel[]> {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${this.getAccessToken()}` } },
    );
    if (!res.ok)
      throw new Error(`YouTube channels lookup failed: ${res.status} ${await res.text()}`);

    const data = (await res.json()) as {
      items?: {
        id: string;
        snippet?: {
          title?: string;
          customUrl?: string;
          thumbnails?: { default?: { url?: string } };
        };
      }[];
    };
    return (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet?.title ?? item.id,
      customUrl: item.snippet?.customUrl,
      thumbnail: item.snippet?.thumbnails?.default?.url,
    }));
  }

  getAccessToken(): string {
    if (!this.token) throw new Error("Token not obtained yet");
    return this.token.value;
  }

  getExpiresIn(): number {
    return this.token?.expiresIn ?? 3600;
  }

  static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as GoogleErrorResponse;
      // invalid_grant: the user revoked access or the refresh token expired — only a new
      // consent fixes it, so the caller marks the account for reconnection.
      if (detail.error === "invalid_grant") throw new Error("RECONNECT_REQUIRED");
      throw new Error(`Google token refresh failed: ${res.status}`);
    }
    const data = (await res.json()) as GoogleTokenResponse;
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }
}
