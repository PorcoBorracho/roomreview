import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Footer from "@/components/Footer";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = {
  title: LEGAL.projectName,
  description: "Submit photos to be reviewed live on stream.",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a0a0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-ground font-sans text-ink antialiased">
        {children}
        <Footer />
      </body>
    </html>
  );
}
