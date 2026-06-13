import crypto from "node:crypto";
import {
  CAPABILITY_MATRIX,
  type ProviderAdapter,
  type PublishInput,
  type PublishResult,
} from "../types";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export type TikTokPublishStatus =
  | { state: "PROCESSING" }
  | { state: "PUBLISHED"; externalPostId: string }
  | { state: "FAILED"; reason: string };

/**
 * TikTok adapter - deliberately separate from the Meta family.
 *
 * Realistic constraints honored:
 * - Content Posting API: video required; publishing is ASYNC (returns a
 *   publish_id which must be polled for status - hence PENDING results).
 * - creator_info must be queried before every post (TikTok policy); it also
 *   reports the privacy levels the app may use.
 * - Unaudited apps may only post SELF_ONLY (private) until TikTok app review.
 * - Refresh tokens supported and required (access tokens are short-lived).
 */
export class TikTokAdapter implements ProviderAdapter {
  readonly provider = "TIKTOK" as const;

  get capabilities() {
    return CAPABILITY_MATRIX.TIKTOK;
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      redirect_uri: redirectUri,
      state,
      scope: "user.info.basic,video.publish,video.list",
      response_type: "code",
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`TIKTOK_OAUTH_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      open_id: string;
      scope: string;
    };

    // Resolve the creator's display name for the settings UI.
    const user = await this.fetchUserInfo(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      externalAccountId: data.open_id,
      displayName: user?.display_name ?? "TikTok account",
      scopes: data.scope.split(","),
    };
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<{ open_id?: string; display_name?: string } | null> {
    const res = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,display_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { user?: { open_id?: string; display_name?: string } };
    };
    return data.data?.user ?? null;
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`TIKTOK_REFRESH_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async publish(
    accessToken: string,
    _openId: string,
    input: PublishInput
  ): Promise<PublishResult> {
    if (input.mediaUrls.length === 0) {
      return { status: "FAILED", error: "TIKTOK_VIDEO_REQUIRED" };
    }

    // TikTok policy: query creator_info before every post. It confirms the
    // creator can receive posts and reports allowed privacy levels.
    const creatorRes = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!creatorRes.ok) {
      return { status: "FAILED", error: `TIKTOK_CREATOR_INFO_FAILED: ${creatorRes.status}` };
    }

    const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        // SELF_ONLY until TikTok app review approves public posting.
        post_info: { title: input.content.slice(0, 150), privacy_level: "SELF_ONLY" },
        source_info: { source: "PULL_FROM_URL", video_url: input.mediaUrls[0] },
      }),
    });
    const data = (await res.json()) as {
      data?: { publish_id?: string };
      error?: { message?: string };
    };
    if (!res.ok || !data.data?.publish_id) {
      return { status: "FAILED", error: data.error?.message ?? `HTTP ${res.status}` };
    }
    // TikTok publishing is async: the status worker polls / webhooks complete it.
    return { status: "PENDING", externalRef: data.data.publish_id };
  }

  /**
   * Poll the async publish status for a publish_id.
   * Note: "publicaly_available_post_id" is TikTok's actual (misspelled) field.
   */
  async fetchPublishStatus(
    accessToken: string,
    publishId: string
  ): Promise<TikTokPublishStatus> {
    const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    if (!res.ok) return { state: "FAILED", reason: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      data?: {
        status?: string;
        publicaly_available_post_id?: string[];
        fail_reason?: string;
      };
    };
    const status = data.data?.status;
    if (status === "PUBLISH_COMPLETE") {
      return {
        state: "PUBLISHED",
        externalPostId: data.data?.publicaly_available_post_id?.[0] ?? publishId,
      };
    }
    if (status === "FAILED") {
      return { state: "FAILED", reason: data.data?.fail_reason ?? "unknown" };
    }
    return { state: "PROCESSING" };
  }

  /** Video metrics for analytics snapshots (requires video.list scope). */
  async fetchPostMetrics(
    accessToken: string,
    _openId: string,
    videoId: string
  ): Promise<Record<string, number>> {
    const res = await fetch(
      `${TIKTOK_API}/video/query/?fields=like_count,comment_count,share_count,view_count`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ filters: { video_ids: [videoId] } }),
      }
    );
    if (!res.ok) throw new Error(`TIKTOK_METRICS_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      data?: { videos?: Array<Record<string, number>> };
    };
    const video = data.data?.videos?.[0];
    return {
      likes: video?.like_count ?? 0,
      comments: video?.comment_count ?? 0,
      shares: video?.share_count ?? 0,
      views: video?.view_count ?? 0,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    const expected = crypto
      .createHmac("sha256", process.env.TIKTOK_CLIENT_SECRET ?? "")
      .update(rawBody)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
