import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { NotificationsList } from "@/features/notifications/notifications-list";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "notifications");
  const tc = getTranslator(locale, "common");

  // Pre-translate every notification type label (no hardcoded strings client-side).
  const typeLabels: Record<string, string> = {};
  for (const type of [
    "COLLAB_REQUEST_RECEIVED",
    "COLLAB_REQUEST_ACCEPTED",
    "COLLAB_REQUEST_REJECTED",
    "GROUP_MEMBER_JOINED",
    "GROUP_MESSAGE",
    "COMMENT_ON_IDEA",
    "REPORT_RESOLVED",
    "OPPORTUNITY_MATCH",
    "SYSTEM",
  ]) {
    typeLabels[type] = t(`type.${type}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>
      <NotificationsList
        locale={locale}
        labels={{
          empty: t("empty"),
          markAllRead: t("markAllRead"),
          loading: tc("state.loading"),
          error: tc("state.error"),
        }}
        typeLabels={typeLabels}
      />
    </div>
  );
}
