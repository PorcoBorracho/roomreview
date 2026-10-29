"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UploadCloud, ShieldCheck, Tv, Lock } from "lucide-react";

type Item = { href: string; label: string; icon: typeof Tv; locked: boolean; match: (p: string) => boolean };

export default function NavLinks({ role }: { role: "admin" | "viewer" | null }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/", label: "Submit", icon: UploadCloud, locked: false, match: (p) => p === "/" },
    { href: "/admin", label: "Admin queue", icon: ShieldCheck, locked: role !== "admin", match: (p) => p.startsWith("/admin") },
    { href: "/streamer", label: "Streamer view", icon: Tv, locked: role === null, match: (p) => p.startsWith("/streamer") },
  ];

  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 rounded-xl border border-line bg-well p-1">
      {items.map(({ href, label, icon: Icon, locked, match }) => {
        const active = match(path);
        return (
          <Link
            key={href}
            href={href}
            prefetch={href === "/" ? undefined : false}
            aria-current={active ? "page" : undefined}
            aria-label={locked ? `${label} (requires password)` : label}
            className={`pressable flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold sm:px-3 ${
              active ? "bg-accent text-on-accent shadow-raised" : "text-muted hover:bg-raised hover:text-white"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden md:inline">{label}</span>
            {locked && <Lock className="size-3 shrink-0 opacity-60" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
