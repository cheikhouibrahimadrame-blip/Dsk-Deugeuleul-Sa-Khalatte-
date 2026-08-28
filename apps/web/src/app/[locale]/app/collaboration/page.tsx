import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getServerSession } from "next-auth";
import { prisma } from "@dsk/db";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { authOptions } from "@/lib/auth/options";
import { getQueryClient } from "@/lib/prefetch";
import { CollabInbox } from "@/features/collaboration/collab-inbox";

export default async function CollaborationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "collab");
  const tc = getTranslator(locale, "common");

  const queryClient = getQueryClient();
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    await queryClient.prefetchQuery({
      queryKey: ["collab", "received"],
      queryFn: () =>
        prisma.collaborationRequest.findMany({
          where: { idea: { ownerId: session.user!.id } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            message: true,
            skillsOffer: true,
            status: true,
            createdAt: true,
            idea: { select: { id: true, title: true } },
            requester: {
              select: { id: true, name: true, image: true, profile: { select: { headline: true, skills: true } } },
            },
          },
        }).then((items) => ({ items })),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold">{t("inbox.title")}</h1>
        <CollabInbox
          locale={locale}
          labels={{
            received: t("inbox.received"),
            sent: t("inbox.sent"),
            empty: t("inbox.empty"),
            accept: t("action.accept"),
            reject: t("action.reject"),
            save: t("action.save"),
            groupFull: t("error.groupFull"),
            loading: tc("state.loading"),
            error: tc("state.error"),
            statusPending: t("status.PENDING"),
            statusAccepted: t("status.ACCEPTED"),
            statusRejected: t("status.REJECTED"),
            statusSaved: t("status.SAVED"),
          }}
        />
      </div>
    </HydrationBoundary>
  );
}
