import Link from "next/link";
import { getTranslator, type Locale } from "@dsk/i18n";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getTranslator(locale, "common");
  const tAuth = getTranslator(locale, "auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("app.name")}</h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">{t("app.tagline")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/${locale}/sign-up`}
          className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
        >
          {tAuth("signup.submit")}
        </Link>
        <Link
          href={`/${locale}/sign-in`}
          className="rounded-lg border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {tAuth("signin.submit")}
        </Link>
      </div>
      <div className="mt-4 flex gap-3 text-sm text-zinc-500">
        <Link href="/en" className={locale === "en" ? "font-semibold underline" : ""}>EN</Link>
        <Link href="/fr" className={locale === "fr" ? "font-semibold underline" : ""}>FR</Link>
      </div>
    </main>
  );
}
