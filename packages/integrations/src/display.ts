import type { IntegrationProvider } from "@dsk/db";

/**
 * Provider display names are brand names: identical in EN and FR, so they
 * live here as data rather than in translation files.
 */
export const PROVIDER_DISPLAY_NAMES: Record<IntegrationProvider, string> = {
  META_FACEBOOK_PAGE: "Facebook Page",
  META_INSTAGRAM_PROFESSIONAL: "Instagram Professional",
  META_WHATSAPP_BUSINESS: "WhatsApp Business",
  TIKTOK: "TikTok",
};
