"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, Users, Flag, UserRound, History } from "lucide-react";
import Segmented from "./Segmented";
import { useT } from "@/i18n/client";

const PANEL_PATHS = ["/", "/admins", "/problems", "/audit", "/account"];

/** Pestañas del panel de control. Admins y Problemas solo para Site Admins. */
export default function PanelNav({ siteAdmin, openProblems }: { siteAdmin: boolean; openProblems: number }) {
  const t = useT();
  const path = usePathname() || "/";
  if (!PANEL_PATHS.includes(path)) return null;
  const items = [
    { key: "/", label: t.panel.boards, icon: LayoutGrid, href: "/" },
    ...(siteAdmin
      ? [
          { key: "/admins", label: t.panel.admins, icon: Users, href: "/admins" },
          { key: "/problems", label: openProblems > 0 ? `${t.panel.problems} · ${openProblems}` : t.panel.problems, icon: Flag, href: "/problems" },
          { key: "/audit", label: t.panel.activity, icon: History, href: "/audit" },
        ]
      : []),
    { key: "/account", label: t.panel.account, icon: UserRound, href: "/account" },
  ];
  return <Segmented kind="nav" tone="accent" ariaLabel={t.header.controlPanel} items={items} active={path} className="w-full sm:w-auto" />;
}
