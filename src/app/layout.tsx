import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "tokyogh0uul Room Review",
  description: "Submit your room to be reviewed on stream.",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = { themeColor: "#08080c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#08080c] text-slate-100 antialiased font-sans selection:bg-twitch-purple selection:text-white">
        <Navbar />
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
