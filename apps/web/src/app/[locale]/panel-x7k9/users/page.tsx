import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { UsersTable } from "@/features/admin/users-table";

export default async function AdminUsersPage({
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
      <h1 className="mb-4 text-lg font-bold">{t("nav.users")}</h1>
      <UsersTable
        labels={{
          loading: tc("state.loading"),
          error: tc("state.error"),
          ban: t("action.ban"),
          unban: t("action.unban"),
        }}
      />
    </div>
  );
}
