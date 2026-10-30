"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, Users, Flag, UserRound, History, Tv, UsersRound } from "lucide-react";
import Segmented from "./Segmented";
import { useT } from "@/i18n/client";

const PANEL_PATHS = ["/panel", "/streamers", "/team", "/admins", "/problems", "/audit", "/account"];

type Props = { role: string; siteAdmin: boolean; openProblems: number; pendingStreamers: number };

/** Pestañas del panel según el rol: Streamers, Admins, Problemas y Actividad para el Owner y los Site Admins; Equipo para los streamers. */
export default function PanelNav({ role, siteAdmin, openProblems, pendingStreamers }: Props) {
  const t = useT();
  const path = usePathname() || "/panel";
  if (!PANEL_PATHS.includes(path)) return null;
  const count = (label: string, n: number) => (n > 0 ? `${label} · ${n}` : label);
  const items = [
    { key: "/panel", label: t.panel.boards, icon: LayoutGrid, href: "/panel" },
    ...(role === "streamer" ? [{ key: "/team", label: t.panel.team, icon: UsersRound, href: "/team" }] : []),
    ...(siteAdmin
      ? [
          { key: "/streamers", label: count(t.panel.streamers, pendingStreamers), icon: Tv, href: "/streamers" },
          { key: "/admins", label: t.panel.admins, icon: Users, href: "/admins" },
          { key: "/problems", label: count(t.panel.problems, openProblems), icon: Flag, href: "/problems" },
          { key: "/audit", label: t.panel.activity, icon: History, href: "/audit" },
        ]
      : []),
    { key: "/account", label: t.panel.account, icon: UserRound, href: "/account" },
  ];
  return <Segmented kind="nav" tone="accent" ariaLabel={t.header.controlPanel} items={items} active={path} className="w-full sm:w-auto" />;
}
