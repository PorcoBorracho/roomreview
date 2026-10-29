import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Footer from "@/components/Footer";
import { LEGAL } from "@/config/legal";
import { THEME_SCRIPT } from "@/lib/theme";
import { getLocale, getT } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: LEGAL.projectName, template: `%s · ${LEGAL.projectName}` },
    description: t.meta.description,
    robots: { index: true, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" },
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce generado por src/proxy.ts para esta petición (CSP estricta)
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  return (
    // suppressHydrationWarning: el script del tema añade data-theme antes de que React hidrate
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-ground font-sans text-ink antialiased">
        <I18nProvider locale={locale}>
          {children}
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
