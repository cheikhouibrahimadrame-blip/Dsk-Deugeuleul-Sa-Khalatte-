import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getServerSession } from "next-auth";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { PROVIDER_DISPLAY_NAMES, CAPABILITY_MATRIX } from "@dsk/integrations";
import { authOptions } from "@/lib/auth/options";
import { getQueryClient } from "@/lib/prefetch";
import { IntegrationCards } from "@/features/integrations/integration-cards";
import { MetaAssetPicker } from "@/features/integrations/meta-asset-picker";

export default async function IntegrationsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pending?: string }>;
}) {
  const [{ locale: rawLocale }, { pending }] = await Promise.all([params, searchParams]);
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "common");

  const queryClient = getQueryClient();
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    await queryClient.prefetchQuery({
      queryKey: ["integrations"],
      queryFn: async () => {
        const accounts = await prisma.integrationAccount.findMany({
          where: { ownerUserId: session.user!.id, revokedAt: null },
          select: {
            id: true,
            provider: true,
            displayName: true,
            status: true,
            scopes: true,
            connectedAt: true,
          },
        });
        return {
          accounts,
          providers: Object.entries(CAPABILITY_MATRIX).map(([provider, capabilities]) => ({
            provider,
            capabilities,
          })),
        };
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
    </HydrationBoundary>
  );
}
