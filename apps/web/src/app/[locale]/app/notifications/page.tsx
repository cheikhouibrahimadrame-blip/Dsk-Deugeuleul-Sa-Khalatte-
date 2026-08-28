import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getServerSession } from "next-auth";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { authOptions } from "@/lib/auth/options";
import { getQueryClient } from "@/lib/prefetch";
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

  const queryClient = getQueryClient();
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    await queryClient.prefetchQuery({
      queryKey: ["notifications"],
      queryFn: async () => {
        const userId = session.user!.id;
        const [items, unreadCount] = await Promise.all([
          prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
          }),
          prisma.notification.count({ where: { userId, readAt: null } }),
        ]);
        return { items, unreadCount };
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
    </HydrationBoundary>
  );
}
