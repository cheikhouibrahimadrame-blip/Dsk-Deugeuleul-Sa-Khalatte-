import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@dsk/i18n";
import { Providers } from "@/components/providers";
import "../globals.css";

export const metadata: Metadata = {
  title: "DSK",
  description: "Share your idea. Get honest feedback. Build together.",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning translate="no">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
