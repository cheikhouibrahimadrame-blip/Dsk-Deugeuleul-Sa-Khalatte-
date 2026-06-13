import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { GroupsList } from "@/features/groups/groups-list";

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "groups");
  const tc = getTranslator(locale, "common");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{t("list.title")}</h1>
      <GroupsList
        locale={locale}
        labels={{
          empty: t("list.empty"),
          loading: tc("state.loading"),
          error: tc("state.error"),
          maxMembers: t("detail.maxMembers", { max: 10 }),
        }}
      />
    </div>
  );
}
