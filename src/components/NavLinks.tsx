"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UploadCloud, ShieldCheck, Tv, Lock } from "lucide-react";

const base = "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2";
const inactive = `${base} bg-twitch-card text-slate-300 hover:text-white border border-twitch-border`;
const active = `${base} bg-twitch-purple text-white shadow-lg glow-purple`;

export default function NavLinks({ role }: { role: "admin" | "viewer" | null }) {
  const path = usePathname();
  const adminUnlocked = role === "admin";
  const viewerUnlocked = role === "admin" || role === "viewer";

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      <Link href="/" className={path === "/" ? active : inactive}>
        <UploadCloud className="w-4 h-4" />
        <span className="hidden sm:inline">Submit Room</span>
      </Link>

      <Link href="/admin" prefetch={false} className={path.startsWith("/admin") ? active : inactive}>
        <ShieldCheck className="w-4 h-4 text-cyber-yellow" />
        <span className="hidden sm:inline">Admin Queue</span>
        {!adminUnlocked && <Lock className="w-3 h-3 text-slate-500" />}
      </Link>

      <Link
        href="/streamer"
        prefetch={false}
        className={
          path.startsWith("/streamer")
            ? `${base} font-bold bg-gradient-to-r from-cyber-pink to-twitch-purple text-white shadow-lg`
            : `${base} font-bold bg-gradient-to-r from-cyber-pink to-twitch-purple text-white hover:opacity-90 shadow-md`
        }
      >
        <Tv className="w-4 h-4" />
        <span className="hidden sm:inline">Streamer View</span>
        {!viewerUnlocked && <Lock className="w-3 h-3 text-white/70" />}
      </Link>
    </nav>
  );
}
