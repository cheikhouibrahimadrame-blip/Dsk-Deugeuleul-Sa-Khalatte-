import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { PROVIDER_DISPLAY_NAMES } from "@dsk/integrations";
import { IntegrationCards } from "@/features/integrations/integration-cards";
import { MetaAssetPicker } from "@/features/integrations/meta-asset-picker";

export default async function IntegrationsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pending?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { pending } = await searchParams;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "common");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">{t("integrations.title")}</h1>
      {pending && (
        <MetaAssetPicker
          pendingId={pending}
          labels={{
            title: t("integrations.chooseAccount"),
            select: t("action.select"),
            loading: t("state.loading"),
            error: t("state.error"),
            empty: t("state.empty"),
          }}
        />
      )}
      <IntegrationCards
        locale={locale}
        providerNames={PROVIDER_DISPLAY_NAMES}
        labels={{
          connect: t("action.connect"),
          disconnect: t("action.disconnect"),
          loading: t("state.loading"),
          error: t("state.error"),
        }}
      />
    </div>
  );
}
