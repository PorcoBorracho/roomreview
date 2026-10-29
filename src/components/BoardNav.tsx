"use client";

import { usePathname } from "next/navigation";
import { Globe, ShieldCheck, Tv } from "lucide-react";
import Segmented from "./Segmented";

export default function BoardNav({ slug, admin }: { slug: string; admin: boolean }) {
  const path = usePathname();
  const base = `/${slug}`;
  const items = [
    { key: base, label: "Public page", icon: Globe, href: base },
    ...(admin ? [{ key: `${base}/queue`, label: "Queue", icon: ShieldCheck, href: `${base}/queue` }] : []),
    { key: `${base}/deck`, label: "Deck", icon: Tv, href: `${base}/deck` },
  ];
  return <Segmented kind="nav" tone="accent" ariaLabel="Board" items={items} active={path} className="w-full sm:w-auto" />;
}
