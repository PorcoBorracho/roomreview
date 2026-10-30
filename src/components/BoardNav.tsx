"use client";

import { usePathname } from "next/navigation";
import { Globe, ShieldCheck, Tv } from "lucide-react";
import Segmented from "./Segmented";
import { useT } from "@/i18n/client";

/** Pestañas de un board para el equipo. base: /{streamer}/{board} */
export default function BoardNav({ base, queue, deck }: { base: string; queue: boolean; deck: boolean }) {
  const t = useT();
  const path = usePathname();
  const items = [
    { key: base, label: t.board.publicPage, icon: Globe, href: base },
    ...(queue ? [{ key: `${base}/queue`, label: t.board.queue, icon: ShieldCheck, href: `${base}/queue` }] : []),
    ...(deck ? [{ key: `${base}/deck`, label: t.board.deck, icon: Tv, href: `${base}/deck` }] : []),
  ];
  return <Segmented kind="nav" tone="accent" ariaLabel={t.header.boards} items={items} active={path} className="w-full sm:w-auto" />;
}
