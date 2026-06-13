import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { AuditTable } from "@/features/admin/audit-table";

export default async function AdminAuditPage({
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
      <h1 className="mb-4 text-lg font-bold">{t("nav.auditLogs")}</h1>
      <AuditTable
        labels={{
          loading: tc("state.loading"),
          error: tc("state.error"),
          empty: tc("state.empty"),
        }}
      />
    </div>
  );
}
