import crypto from "node:crypto";
import type { IntegrationProvider } from "@dsk/db";
import {
  CAPABILITY_MATRIX,
  type MetaAsset,
  type ProviderAdapter,
  type PublishInput,
  type PublishResult,
} from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Meta provider family foundation (Facebook Pages, Instagram professional,
 * WhatsApp Business). One adapter per surface, sharing Meta OAuth + webhook
 * signature verification (X-Hub-Signature-256, HMAC-SHA256 with app secret).
 *
 * Realistic constraints honored:
 * - Facebook: publish to PAGES the user manages (never personal profiles).
 * - Instagram: professional accounts only; publishing requires media.
 * - WhatsApp Business: no feed; business messaging via approved templates only.
 */
abstract class MetaBaseAdapter implements ProviderAdapter {
  abstract readonly provider: IntegrationProvider;
  abstract readonly scopes: string[];

  get capabilities() {
    return CAPABILITY_MATRIX[this.provider];
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID ?? "",
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(","),
      response_type: "code",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
    if (!res.ok) throw new Error(`META_OAUTH_FAILED: ${res.status}`);
    const shortLived = (await res.json()) as { access_token: string; expires_in?: number };

    // Upgrade to a long-lived user token (~60 days). Meta has no refresh
    // grant: near expiry the account flips to EXPIRED and the user reconnects.
    const longLived = await this.exchangeForLongLivedToken(shortLived.access_token);

    // Account selection (page / IG business / WABA) happens in a follow-up
    // step in the connection flow; this returns the user-level token first.
    return {
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresAt,
      externalAccountId: "pending-selection",
      displayName: "Meta account",
      scopes: this.scopes,
    };
  }

  protected async exchangeForLongLivedToken(shortToken: string) {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      fb_exchange_token: shortToken,
    });
    const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
    if (!res.ok) throw new Error(`META_LONG_LIVED_EXCHANGE_FAILED: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async refreshToken(): Promise<never> {
    // Meta uses long-lived token exchange rather than refresh tokens.
    throw new Error("META_USE_LONG_LIVED_EXCHANGE");
  }

  abstract publish(
    accessToken: string,
    externalAccountId: string,
    input: PublishInput
  ): Promise<PublishResult>;

  /** List the assets the user can connect on this surface. */
  abstract listAssets(accessToken: string): Promise<MetaAsset[]>;

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.META_APP_SECRET ?? "")
        .update(rawBody)
        .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}

export class FacebookPageAdapter extends MetaBaseAdapter {
  readonly provider = "META_FACEBOOK_PAGE" as const;
  readonly scopes = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"];

  async publish(
    accessToken: string,
    pageId: string,
    input: PublishInput
  ): Promise<PublishResult> {
    const res = await fetch(`${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.content, access_token: accessToken }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!res.ok || !data.id) {
      return { status: "FAILED", error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { status: "PUBLISHED", externalPostId: data.id };
  }

  /** Pages the user manages. The page-scoped token is what gets stored. */
  async listAssets(accessToken: string): Promise<MetaAsset[]> {
    const params = new URLSearchParams({
      fields: "id,name,access_token",
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/me/accounts?${params}`);
    if (!res.ok) throw new Error(`META_LIST_PAGES_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{ id: string; name: string; access_token?: string }>;
    };
    return (data.data ?? []).map((page) => ({
      externalAccountId: page.id,
      displayName: page.name,
      assetToken: page.access_token,
    }));
  }

  async fetchPostMetrics(
    accessToken: string,
    _pageId: string,
    externalPostId: string
  ): Promise<Record<string, number>> {
    const params = new URLSearchParams({
      fields: "reactions.summary(true),comments.summary(true),shares",
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/${externalPostId}?${params}`);
    if (!res.ok) throw new Error(`META_FB_METRICS_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      reactions?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    };
    return {
      reactions: data.reactions?.summary?.total_count ?? 0,
      comments: data.comments?.summary?.total_count ?? 0,
      shares: data.shares?.count ?? 0,
    };
  }
}

export class InstagramProfessionalAdapter extends MetaBaseAdapter {
  readonly provider = "META_INSTAGRAM_PROFESSIONAL" as const;
  readonly scopes = ["instagram_basic", "instagram_content_publish", "pages_show_list"];

  async publish(
    accessToken: string,
    igUserId: string,
    input: PublishInput
  ): Promise<PublishResult> {
    if (input.mediaUrls.length === 0) {
      return { status: "FAILED", error: "IG_MEDIA_REQUIRED" };
    }
    // Two-step: create media container, then publish it.
    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: input.mediaUrls[0],
        caption: input.content,
        access_token: accessToken,
      }),
    });
    const container = (await containerRes.json()) as { id?: string; error?: { message: string } };
    if (!containerRes.ok || !container.id) {
      return { status: "FAILED", error: container.error?.message ?? `HTTP ${containerRes.status}` };
    }

    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    });
    const published = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (!publishRes.ok || !published.id) {
      return { status: "FAILED", error: published.error?.message ?? `HTTP ${publishRes.status}` };
    }
    return { status: "PUBLISHED", externalPostId: published.id };
  }

  /** IG professional accounts linked to pages the user manages. */
  async listAssets(accessToken: string): Promise<MetaAsset[]> {
    const params = new URLSearchParams({
      fields: "name,instagram_business_account{id,username}",
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/me/accounts?${params}`);
    if (!res.ok) throw new Error(`META_LIST_IG_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{
        name: string;
        instagram_business_account?: { id: string; username: string };
      }>;
    };
    return (data.data ?? [])
      .filter((page) => page.instagram_business_account)
      .map((page) => ({
        externalAccountId: page.instagram_business_account!.id,
        displayName: `@${page.instagram_business_account!.username}`,
      }));
  }

  async fetchPostMetrics(
    accessToken: string,
    _igUserId: string,
    mediaId: string
  ): Promise<Record<string, number>> {
    const params = new URLSearchParams({
      metric: "impressions,reach,likes,comments,saved",
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/${mediaId}/insights?${params}`);
    if (!res.ok) throw new Error(`META_IG_METRICS_FAILED: ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
    };
    return Object.fromEntries(
      (data.data ?? []).map((m) => [m.name, m.values?.[0]?.value ?? 0])
    );
  }
}

export class WhatsAppBusinessAdapter extends MetaBaseAdapter {
  readonly provider = "META_WHATSAPP_BUSINESS" as const;
  readonly scopes = ["whatsapp_business_messaging", "whatsapp_business_management"];

  async publish(): Promise<PublishResult> {
    // WhatsApp has no public feed: publishing is not a capability.
    return { status: "FAILED", error: "WHATSAPP_NO_FEED" };
  }

  /** WhatsApp Business Accounts owned by the user's businesses. */
  async listAssets(accessToken: string): Promise<MetaAsset[]> {
    const bizRes = await fetch(
      `${GRAPH}/me/businesses?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!bizRes.ok) throw new Error(`META_LIST_BUSINESSES_FAILED: ${bizRes.status}`);
    const businesses = (await bizRes.json()) as {
      data?: Array<{ id: string; name: string }>;
    };

    const assets: MetaAsset[] = [];
    for (const biz of businesses.data ?? []) {
      const wabaRes = await fetch(
        `${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(accessToken)}`
      );
      if (!wabaRes.ok) continue;
      const wabas = (await wabaRes.json()) as {
        data?: Array<{ id: string; name?: string }>;
      };
      for (const waba of wabas.data ?? []) {
        assets.push({
          externalAccountId: waba.id,
          displayName: waba.name ?? `${biz.name} WABA`,
        });
      }
    }
    return assets;
  }

  /**
   * Sends an approved template message (business-initiated messaging).
   * Used by the notifications system for opted-in users only.
   */
  async sendTemplateMessage(
    accessToken: string,
    toPhone: string,
    templateName: string,
    languageCode: "en" | "fr"
  ): Promise<{ ok: boolean; error?: string }> {
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
    if (!phoneNumberId) return { ok: false, error: "WHATSAPP_NOT_CONFIGURED" };

    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: { name: templateName, language: { code: languageCode } },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  }
}
