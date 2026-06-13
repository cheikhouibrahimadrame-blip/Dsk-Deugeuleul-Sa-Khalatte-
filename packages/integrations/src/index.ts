// Server-only package (uses node:crypto). Never import from client components;
// pass derived data (names, capabilities) down as props instead.
export * from "./types";
export * from "./crypto";
export * from "./registry";
export * from "./display";
export {
  FacebookPageAdapter,
  InstagramProfessionalAdapter,
  WhatsAppBusinessAdapter,
} from "./meta/adapter";
export { TikTokAdapter } from "./tiktok/adapter";
