import type { Metadata } from "next";
import { requireAccountPage } from "@/lib/session";
import { listBoardsWithStats } from "@/lib/boards";
import { getT } from "@/i18n/server";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).header.controlPanel, robots: { index: false } };
}

export default async function ControlPanelPage() {
  const acc = await requireAccountPage("/");
  const boards = await listBoardsWithStats(acc);
  return <Dashboard boards={boards} viewer={{ id: acc.id, siteAdmin: acc.role === "site_admin" }} />;
}
