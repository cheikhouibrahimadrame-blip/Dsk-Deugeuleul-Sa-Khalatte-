import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { FeatureFlags } from "@/features/admin/feature-flags";

export default async function AdminFlagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "admin");
  const tc = getTranslator(locale, "common");

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">{t("nav.featureFlags")}</h1>
      <FeatureFlags
        labels={{
          loading: tc("state.loading"),
          error: tc("state.error"),
          save: tc("action.save"),
        }}
      />
    </div>
  );
}
