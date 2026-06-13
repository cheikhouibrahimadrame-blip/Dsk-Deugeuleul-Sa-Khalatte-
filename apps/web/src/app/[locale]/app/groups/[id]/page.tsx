import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
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

  return (
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
  );
}
