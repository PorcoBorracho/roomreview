import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getBoard, isPublic } from "@/lib/boards";
import { REPORT_RESOLVED_DAYS } from "@/lib/limits";
import ReportForm from "@/components/ReportForm";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).report.title };
}

const PAGE_RE = /^\/[A-Za-z0-9/_\-.]{0,199}$/;

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const raw = (await searchParams).page;
  const page = typeof raw === "string" && PAGE_RE.test(raw) ? raw : "";
  // Si viene de la página de un board (/{streamer}/{board}/…), se asocia el reporte a ese board
  const [, login = "", slug = ""] = page.split("/");
  const board = login && slug ? await getBoard(login, slug) : null;
  const visibleBoard = board && isPublic(board) ? board : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.report.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted">{t.report.intro}</p>
      <div className="mt-8 rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-7">
        <ReportForm page={page} boardId={visibleBoard?.id ?? ""} boardTitle={visibleBoard?.title ?? ""} retentionDays={REPORT_RESOLVED_DAYS} />
      </div>
    </div>
  );
}
