import type { Metadata } from "next";
import { LEGAL } from "@/config/legal";
import { requireAdminPage } from "@/lib/session";
import { listBoardsWithStats } from "@/lib/boards";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Control panel · ${LEGAL.projectName}`, robots: { index: false } };

export default async function ControlPanelPage() {
  await requireAdminPage("/");
  const boards = await listBoardsWithStats();
  return <Dashboard boards={boards} />;
}
