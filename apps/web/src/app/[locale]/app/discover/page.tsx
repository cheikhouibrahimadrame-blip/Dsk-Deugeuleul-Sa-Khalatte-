import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { getQueryClient } from "@/lib/prefetch";
import { IdeaFeed } from "@/features/ideas/idea-feed";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "ideas");
  const tc = getTranslator(locale, "common");

  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["ideas", "feed"],
    queryFn: async () => {
      const limit = 20;
      const ideas = await prisma.idea.findMany({
        where: { status: "PUBLISHED", deletedAt: null },
        orderBy: { publishedAt: "desc" },
        take: limit + 1,
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          language: true,
          publishedAt: true,
          owner: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true, reactions: true, collaborationRequests: true } },
        },
      });
      const hasMore = ideas.length > limit;
      const items = hasMore ? ideas.slice(0, -1) : ideas;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      };
    },
    initialPageParam: null as string | null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold">{t("feed.title")}</h1>
        <IdeaFeed
          labels={{
            empty: t("feed.empty"),
            loading: tc("state.loading"),
            error: tc("state.error"),
          }}
          locale={locale}
        />
      </div>
    </HydrationBoundary>
  );
}
