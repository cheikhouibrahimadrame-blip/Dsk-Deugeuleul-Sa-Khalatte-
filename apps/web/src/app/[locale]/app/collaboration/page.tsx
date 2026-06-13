import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
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

  return (
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
  );
}
