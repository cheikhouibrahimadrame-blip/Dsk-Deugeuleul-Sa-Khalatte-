import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator, isLocale, type Locale } from "@dsk/i18n";
import { requireHiddenAdmin, AuthError } from "@/lib/auth/guards";

/**
 * HIDDEN ADMIN PANEL.
 * - Never linked from any navigation or sitemap.
 * - Deny by default: non-admins receive a 404 (not 403) so the panel's
 *   existence is never confirmed.
 * - Every sensitive action inside must write an AuditLog entry.
 */
export default async function HiddenAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  try {
    await requireHiddenAdmin();
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }

  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = getTranslator(locale, "admin");
  const base = `/${locale}/panel-x7k9`;

  const nav = [
    { href: base, label: t("title") },
    { href: `${base}/reports`, label: t("nav.reports") },
    { href: `${base}/users`, label: t("nav.users") },
    { href: `${base}/flags`, label: t("nav.featureFlags") },
    { href: `${base}/audit`, label: t("nav.auditLogs") },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
          DSK Admin
        </p>
        <nav className="mt-2 flex flex-wrap gap-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
