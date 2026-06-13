import type { IntegrationProvider } from "@dsk/db";

/**
 * Capability matrix: what each provider can realistically do via official APIs.
 * No fantasy features - personal-account posting, follower scraping, etc. are
 * deliberately absent.
 */
export type ProviderCapabilities = {
  /** Publish content (text/media) to the connected account. */
  publish: boolean;
  /** Pull post/account analytics. */
  analytics: boolean;
  /** Receive inbound webhooks (events, messages). */
  webhooks: boolean;
  /** Send business-initiated messages (WhatsApp templates only). */
  messaging: boolean;
  /** Publish requires media (e.g. Instagram, TikTok cannot post bare text). */
  requiresMedia: boolean;
};

export const CAPABILITY_MATRIX: Record<IntegrationProvider, ProviderCapabilities> = {
  META_FACEBOOK_PAGE: {
    publish: true,
    analytics: true,
    webhooks: true,
    messaging: false,
    requiresMedia: false,
  },
  META_INSTAGRAM_PROFESSIONAL: {
    publish: true,
    analytics: true,
    webhooks: true,
    messaging: false,
    requiresMedia: true, // IG content publishing requires image/video
  },
  META_WHATSAPP_BUSINESS: {
    publish: false, // WhatsApp has no "feed" - messaging only
    analytics: true,
    webhooks: true,
    messaging: true, // template messages within policy windows
    requiresMedia: false,
  },
  TIKTOK: {
    publish: true, // video posting via Content Posting API
    analytics: true,
    webhooks: true,
    messaging: false,
    requiresMedia: true, // video required
  },
};

export type PublishInput = {
  content: string;
  mediaUrls: string[];
};

export type PublishResult =
  | { status: "PUBLISHED"; externalPostId: string }
  | { status: "PENDING"; externalRef: string } // async providers (TikTok) poll for status
  | { status: "FAILED"; error: string };

/**
 * A selectable Meta asset (Facebook Page, IG professional account, WABA).
 * assetToken is the asset-scoped token (e.g. Page access token) when the
 * platform issues one; it must NEVER be returned to the browser.
 */
export type MetaAsset = {
  externalAccountId: string;
  displayName: string;
  assetToken?: string;
};

/**
 * Every provider implements this contract. The rest of the system only talks
 * to adapters - never to provider HTTP APIs directly.
 */
export interface ProviderAdapter {
  readonly provider: IntegrationProvider;
  readonly capabilities: ProviderCapabilities;

  /** Build the OAuth authorization URL to start account connection. */
  getAuthorizationUrl(state: string, redirectUri: string): string;

  /** Exchange the OAuth code for tokens. Returns raw token data to encrypt+store. */
  exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    externalAccountId: string;
    displayName: string;
    scopes: string[];
  }>;

  /** Refresh an expiring token. Throws if the provider does not support refresh. */
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  /** Publish content. Only valid when capabilities.publish is true. */
  publish(accessToken: string, externalAccountId: string, input: PublishInput): Promise<PublishResult>;

  /** Verify an inbound webhook request signature. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;

  /**
   * List selectable assets for two-step connections (Meta surfaces only).
   * Absent on single-step providers like TikTok.
   */
  listAssets?(accessToken: string): Promise<MetaAsset[]>;

  /** Pull per-post metrics for analytics snapshots, when supported. */
  fetchPostMetrics?(
    accessToken: string,
    externalAccountId: string,
    externalPostId: string
  ): Promise<Record<string, number>>;
}
