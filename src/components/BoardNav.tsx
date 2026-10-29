"use client";

import { usePathname } from "next/navigation";
import { Globe, ShieldCheck, Tv } from "lucide-react";
import Segmented from "./Segmented";
import { useT } from "@/i18n/client";

export default function BoardNav({ slug, queue, deck }: { slug: string; queue: boolean; deck: boolean }) {
  const t = useT();
  const path = usePathname();
  const base = `/${slug}`;
  const items = [
    { key: base, label: t.board.publicPage, icon: Globe, href: base },
    ...(queue ? [{ key: `${base}/queue`, label: t.board.queue, icon: ShieldCheck, href: `${base}/queue` }] : []),
    ...(deck ? [{ key: `${base}/deck`, label: t.board.deck, icon: Tv, href: `${base}/deck` }] : []),
  ];
  return <Segmented kind="nav" tone="accent" ariaLabel={t.header.boards} items={items} active={path} className="w-full sm:w-auto" />;
}
