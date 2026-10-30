import type { Metadata } from "next";
import { requireSiteAdminPage } from "@/lib/session";
import { listStreamersForAdmin } from "@/lib/streamers";
import { twitchEnabled } from "@/lib/twitch";
import { getT } from "@/i18n/server";
import StreamersManager from "@/components/StreamersManager";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).streamers.title, robots: { index: false } };
}

/** Streamers (Owner y Site Admins): aprobar solicitudes, suspender y gestionar sus equipos. */
export default async function StreamersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSiteAdminPage("/streamers");
  const sp = await searchParams;
  const status = sp.status === "active" || sp.status === "suspended" ? sp.status : "pending";
  const all = await listStreamersForAdmin();
  return <StreamersManager streamers={all} status={status} twitchConfigured={twitchEnabled()} />;
}
