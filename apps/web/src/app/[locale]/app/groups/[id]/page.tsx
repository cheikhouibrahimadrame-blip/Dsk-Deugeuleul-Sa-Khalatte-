import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { getQueryClient } from "@/lib/prefetch";
import { GroupChat } from "@/features/groups/group-chat";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "groups");
  const tc = getTranslator(locale, "common");

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["group", id],
      queryFn: () =>
        prisma.group.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
            idea: { select: { id: true, title: true } },
            members: {
              where: { status: "ACTIVE" },
              orderBy: { joinedAt: "asc" },
              select: {
                role: true,
                joinedAt: true,
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["group", id, "messages"],
      queryFn: async () => {
        const limit = 50;
        const messages = await prisma.groupMessage.findMany({
          where: { groupId: id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            pinnedAt: true,
            sender: { select: { id: true, name: true, image: true } },
          },
        });
        const hasMore = messages.length > limit;
        const items = hasMore ? messages.slice(0, -1) : messages;
        return {
          items: items.reverse(),
          nextCursor: hasMore ? items[0]?.id ?? null : null,
        };
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GroupChat
        groupId={id}
        labels={{
          members: t("detail.members"),
          full: t("detail.full", { max: 10 }),
          placeholder: t("chat.placeholder"),
          send: t("chat.send"),
          loading: tc("state.loading"),
          error: tc("state.error"),
          typing: t("chat.typing"),
          pinned: t("chat.pinned"),
          live: t("chat.live"),
        }}
      />
    </HydrationBoundary>
  );
}
