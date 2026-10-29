import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Footer from "@/components/Footer";
import { LEGAL } from "@/config/legal";
import { THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: LEGAL.projectName,
  description: "Submit photos to be reviewed live on stream.",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" },
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce generado por src/proxy.ts para esta petición (CSP estricta)
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: el script del tema añade data-theme antes de que React hidrate
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-ground font-sans text-ink antialiased">
        {children}
        <Footer />
      </body>
    </html>
  );
}
