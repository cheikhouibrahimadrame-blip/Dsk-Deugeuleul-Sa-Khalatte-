import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { IdeaFeed } from "@/features/ideas/idea-feed";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "ideas");
  const tc = getTranslator(locale, "common");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{t("feed.title")}</h1>
      <IdeaFeed
        labels={{
          empty: t("feed.empty"),
          loading: tc("state.loading"),
          error: tc("state.error"),
        }}
        locale={locale}
      />
    </div>
  );
}
