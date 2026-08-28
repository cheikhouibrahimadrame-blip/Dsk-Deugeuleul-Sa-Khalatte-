import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { authOptions } from "@/lib/auth/options";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Authenticated app shell. Mobile-first: bottom nav on small screens,
 * sidebar on desktop. The hidden admin panel is intentionally NOT linked here.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/sign-in`);

  const t = getTranslator(locale, "common");

  const nav = [
    { href: `/${locale}/app/discover`, label: t("nav.discover") },
    { href: `/${locale}/app/ideas/new`, label: t("nav.newIdea") },
    { href: `/${locale}/app/collaboration`, label: t("nav.collab") },
    { href: `/${locale}/app/groups`, label: t("nav.groups") },
    { href: `/${locale}/app/notifications`, label: t("nav.notifications") },
  ];

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800 sm:block">
        <p className="mb-6 text-lg font-bold">{t("app.name")}</p>
        <nav className="flex flex-col gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">
          <LocaleSwitcher current={locale} />
        </div>
      </aside>
      <main className="flex-1 p-4 pb-20 sm:pb-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950 sm:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} prefetch={true} className="px-2 py-1 text-xs">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
