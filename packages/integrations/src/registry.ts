import type { IntegrationProvider } from "@dsk/db";
import type { ProviderAdapter } from "./types";
import {
  FacebookPageAdapter,
  InstagramProfessionalAdapter,
  WhatsAppBusinessAdapter,
} from "./meta/adapter";
import { TikTokAdapter } from "./tiktok/adapter";

const adapters: Record<IntegrationProvider, ProviderAdapter> = {
  META_FACEBOOK_PAGE: new FacebookPageAdapter(),
  META_INSTAGRAM_PROFESSIONAL: new InstagramProfessionalAdapter(),
  META_WHATSAPP_BUSINESS: new WhatsAppBusinessAdapter(),
  TIKTOK: new TikTokAdapter(),
};

export function getAdapter(provider: IntegrationProvider): ProviderAdapter {
  return adapters[provider];
}
