import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "tokyogh0uul Room Review",
  description: "Submit your room to be reviewed on stream.",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a0a0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-ground font-sans text-ink antialiased">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
