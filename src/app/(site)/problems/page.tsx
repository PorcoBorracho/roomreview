import type { Metadata } from "next";
import { requireSiteAdminPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getT } from "@/i18n/server";
import ProblemsList, { type ProblemItem } from "@/components/ProblemsList";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).problems.title, robots: { index: false } };
}

type Row = {
  id: string; page: string; category: string; message: string; contact_email: string | null; locale: string;
  status: "open" | "resolved"; created_at: string; resolved_at: string | null;
  board: { slug: string; title: string; streamer: { username: string } | null } | null;
};

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSiteAdminPage("/problems");
  const sp = await searchParams;
  const status = sp.status === "resolved" || sp.status === "all" ? sp.status : "open";
  const db = supabaseAdmin();
  let q = db
    .from("problem_reports")
    .select("id, page, category, message, contact_email, locale, status, created_at, resolved_at, board:boards(slug, title, streamer:admins!boards_streamer_id_fkey(username))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  const [{ data, error }, { count }] = await Promise.all([
    q,
    db.from("problem_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (error) throw new Error("Could not load reports");

  const items: ProblemItem[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    page: r.page,
    category: r.category,
    message: r.message,
    email: r.contact_email,
    locale: r.locale,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    board: r.board ? { title: r.board.title, href: r.board.streamer ? `/${r.board.streamer.username}/${r.board.slug}` : null } : null,
  }));
  return <ProblemsList items={items} status={status} openCount={count ?? 0} />;
}
