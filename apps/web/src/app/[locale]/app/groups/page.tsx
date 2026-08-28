import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getServerSession } from "next-auth";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { authOptions } from "@/lib/auth/options";
import { getQueryClient } from "@/lib/prefetch";
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

  const queryClient = getQueryClient();
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    await queryClient.prefetchQuery({
      queryKey: ["groups"],
      queryFn: async () => {
        const userId = session.user!.id;
        const memberships = await prisma.groupMember.findMany({
          where: { userId, status: "ACTIVE", group: { deletedAt: null } },
          orderBy: { joinedAt: "desc" },
          select: {
            role: true,
            lastReadAt: true,
            group: {
              select: {
                id: true,
                name: true,
                description: true,
                maxMembers: true,
                idea: { select: { id: true, title: true } },
                _count: { select: { members: { where: { status: "ACTIVE" } } } },
              },
            },
          },
        });
        const items = await Promise.all(
          memberships.map(async (m) => {
            const unreadCount = await prisma.groupMessage.count({
              where: {
                groupId: m.group.id,
                deletedAt: null,
                senderId: { not: userId },
                ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
              },
            });
            return { role: m.role, unreadCount, ...m.group };
          })
        );
        return { items };
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
    </HydrationBoundary>
  );
}
