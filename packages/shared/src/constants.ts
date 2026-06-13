/** Hard product cap: a group can never exceed 10 active members. */
export const MAX_GROUP_MEMBERS = 10;

/** Supported UI locales. Wolof (wo) is reserved for the future. */
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export const FUTURE_LOCALES = ["wo"] as const;
export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const API_VERSION = "v1" as const;

/** Pagination defaults for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
