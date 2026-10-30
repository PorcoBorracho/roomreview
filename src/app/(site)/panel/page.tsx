import type { Metadata } from "next";
import { HOME_PANEL, isSiteAdmin, requireAccountPage } from "@/lib/session";
import { allowedStreamers, listBoardsWithStats } from "@/lib/boards";
import { getT } from "@/i18n/server";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).header.controlPanel, robots: { index: false } };
}

export default async function ControlPanelPage() {
  const acc = await requireAccountPage(HOME_PANEL);
  const [boards, streamers] = await Promise.all([listBoardsWithStats(acc), allowedStreamers(acc)]);
  return (
    <Dashboard
      boards={boards}
      streamers={streamers}
      viewer={{ id: acc.id, role: acc.role, siteAdmin: isSiteAdmin(acc) }}
    />
  );
}
