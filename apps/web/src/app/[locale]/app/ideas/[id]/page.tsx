import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { getQueryClient } from "@/lib/prefetch";
import { IdeaDetail } from "@/features/ideas/idea-detail";

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "ideas");
  const tc = getTranslator(locale, "common");
  const tcollab = getTranslator(locale, "collab");

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["idea", id],
    queryFn: () =>
      prisma.idea.findFirst({
        where: { id, status: "PUBLISHED", deletedAt: null },
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          language: true,
          publishedAt: true,
          owner: { select: { id: true, name: true, image: true } },
          comments: {
            where: { status: "VISIBLE", deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              helpfulCount: true,
              unhelpfulCount: true,
              createdAt: true,
              anonymousIdentity: { select: { displayCode: true } },
            },
          },
          _count: { select: { reactions: true, collaborationRequests: true } },
        },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IdeaDetail
        ideaId={id}
        labels={{
          comments: t("detail.comments"),
          workTogether: t("detail.workTogether"),
          commentPlaceholder: t("comment.placeholder"),
          commentSubmit: t("comment.submit"),
          helpful: t("comment.helpful"),
          unhelpful: t("comment.unhelpful"),
          report: t("comment.report"),
          loading: tc("state.loading"),
          error: tc("state.error"),
          modalTitle: tcollab("modal.title"),
          modalMessage: tcollab("modal.message"),
          modalSkills: tcollab("modal.skills"),
          modalSubmit: tcollab("modal.submit"),
          modalSuccess: tcollab("modal.success"),
          alreadyRequested: tcollab("modal.alreadyRequested"),
          cancel: tc("action.cancel"),
        }}
      />
    </HydrationBoundary>
  );
}
