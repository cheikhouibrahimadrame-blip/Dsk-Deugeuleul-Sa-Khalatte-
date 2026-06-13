import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { CreateIdeaForm } from "@/features/ideas/create-idea-form";

export default async function NewIdeaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "ideas");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{t("create.title")}</h1>
      <CreateIdeaForm
        locale={locale}
        labels={{
          title: t("create.fieldTitle"),
          description: t("create.fieldDescription"),
          publish: t("create.publish"),
          saveDraft: t("create.saveDraft"),
        }}
      />
    </div>
  );
}
