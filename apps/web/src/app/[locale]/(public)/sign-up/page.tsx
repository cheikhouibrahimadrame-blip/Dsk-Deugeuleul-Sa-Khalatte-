import { getTranslator, type Locale } from "@dsk/i18n";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getTranslator(locale, "auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold">{t("signup.title")}</h1>
      <SignUpForm
        locale={locale}
        labels={{
          displayName: t("signup.displayName"),
          email: t("signin.email"),
          password: t("signin.password"),
          submit: t("signup.submit"),
          emailTaken: t("error.emailTaken"),
          verifySent: t("verify.sent"),
        }}
      />
    </main>
  );
}
