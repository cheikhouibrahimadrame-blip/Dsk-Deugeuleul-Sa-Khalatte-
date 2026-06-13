"use client";

import { usePathname, useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, LOCALE_COOKIE, type Locale } from "@dsk/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Swaps the locale segment of the current URL and persists the preference.
 * The URL stays the source of truth; the cookie only steers locale-less visits.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (locale: Locale) => {
    if (locale === current) return;
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR}`;
    const segments = pathname.split("/");
    segments[1] = locale;
    router.push(segments.join("/") || `/${locale}`);
  };

  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-current={locale === current ? "true" : undefined}
          className={
            "rounded px-2 py-1 text-xs font-medium uppercase " +
            (locale === current
              ? "bg-brand-600 text-white"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")
          }
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
