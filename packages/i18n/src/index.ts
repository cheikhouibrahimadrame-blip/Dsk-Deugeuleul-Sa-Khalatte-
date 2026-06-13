import en_common from "./locales/en/common.json";
import en_auth from "./locales/en/auth.json";
import en_ideas from "./locales/en/ideas.json";
import en_groups from "./locales/en/groups.json";
import en_collab from "./locales/en/collab.json";
import en_notifications from "./locales/en/notifications.json";
import en_validation from "./locales/en/validation.json";
import en_emails from "./locales/en/emails.json";
import en_admin from "./locales/en/admin.json";
import en_integrations from "./locales/en/integrations.json";
import fr_common from "./locales/fr/common.json";
import fr_auth from "./locales/fr/auth.json";
import fr_ideas from "./locales/fr/ideas.json";
import fr_groups from "./locales/fr/groups.json";
import fr_collab from "./locales/fr/collab.json";
import fr_notifications from "./locales/fr/notifications.json";
import fr_validation from "./locales/fr/validation.json";
import fr_emails from "./locales/fr/emails.json";
import fr_admin from "./locales/fr/admin.json";
import fr_integrations from "./locales/fr/integrations.json";

/**
 * Locale registry.
 * Future-ready: Wolof ("wo") is already reserved in the DB Locale enum.
 * Shipping it later means adding "wo" here plus a locales/wo folder -
 * nothing else in the app changes (missing keys fall back to English).
 */
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie used by middleware and the locale switcher to persist preference. */
export const LOCALE_COOKIE = "dsk_locale";

export type Namespace =
  | "common"
  | "auth"
  | "ideas"
  | "groups"
  | "collab"
  | "notifications"
  | "validation"
  | "emails"
  | "admin"
  | "integrations";

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Record<Namespace, Dictionary>> = {
  en: {
    common: en_common,
    auth: en_auth,
    ideas: en_ideas,
    groups: en_groups,
    collab: en_collab,
    notifications: en_notifications,
    validation: en_validation,
    emails: en_emails,
    admin: en_admin,
    integrations: en_integrations,
  },
  fr: {
    common: fr_common,
    auth: fr_auth,
    ideas: fr_ideas,
    groups: fr_groups,
    collab: fr_collab,
    notifications: fr_notifications,
    validation: fr_validation,
    emails: fr_emails,
    admin: fr_admin,
    integrations: fr_integrations,
  },
};

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Returns a translator for a locale + namespace.
 * Fallback chain: requested locale -> English -> the key itself.
 * Works in any runtime (server components, route handlers, workers, client).
 */
export function getTranslator(locale: Locale, namespace: Namespace) {
  const dict = dictionaries[locale][namespace];
  const fallback = dictionaries[DEFAULT_LOCALE][namespace];
  return function t(key: string, vars?: Record<string, string | number>): string {
    let value = dict[key] ?? fallback[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  };
}
