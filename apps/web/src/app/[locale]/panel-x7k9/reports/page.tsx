import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { ReportsQueue } from "@/features/admin/reports-queue";

export default async function AdminReportsPage({
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
      <h1 className="mb-4 text-lg font-bold">{t("nav.reports")}</h1>
      <ReportsQueue
        labels={{
          loading: tc("state.loading"),
          error: tc("state.error"),
          empty: tc("state.empty"),
          hide: t("action.hide"),
          remove: tc("action.delete"),
          restore: t("action.restore"),
          dismiss: t("action.dismiss"),
        }}
      />
    </div>
  );
}
