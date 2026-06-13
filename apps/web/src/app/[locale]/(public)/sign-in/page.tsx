import { getTranslator, type Locale } from "@dsk/i18n";
import { SignInForm } from "@/features/auth/sign-in-form";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getTranslator(locale, "auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">{t("signin.title")}</h1>
      <SignInForm
        locale={locale}
        labels={{
          email: t("signin.email"),
          password: t("signin.password"),
          submit: t("signin.submit"),
          invalidCredentials: t("error.invalidCredentials"),
        }}
      />
    </main>
  );
}
