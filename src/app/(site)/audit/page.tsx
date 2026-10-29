import type { Metadata } from "next";
import { requireSiteAdminPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AUDIT_CATEGORIES } from "@/lib/audit";
import { AUDIT_DAYS } from "@/lib/limits";
import { uuidSchema } from "@/lib/validation";
import { getT } from "@/i18n/server";
import AuditLog, { type AuditEntry } from "@/components/AuditLog";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).audit.title, robots: { index: false } };
}

const PAGE_SIZE = 50;

type Row = {
  id: number; created_at: string; actor_type: string; actor_name: string; action: string;
  board_id: string | null; board_title: string; target_id: string | null; target_name: string | null;
  details: Record<string, unknown>; ip_hash: string | null;
};

/** Registro de auditoría: solo Site Admins. Paginación por id ("anteriores a…"), estable aunque lleguen entradas nuevas. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; board?: string; before?: string }> }) {
  await requireSiteAdminPage("/audit");
  const sp = await searchParams;
  const category = sp.type && sp.type in AUDIT_CATEGORIES ? sp.type : "all";
  const board = sp.board && uuidSchema.safeParse(sp.board).success ? sp.board : "";
  const before = sp.before && /^\d{1,18}$/.test(sp.before) ? sp.before : "";

  const db = supabaseAdmin();
  let q = db
    .from("audit_log")
    .select("id, created_at, actor_type, actor_name, action, board_id, board_title, target_id, target_name, details, ip_hash")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (category !== "all") q = q.in("action", AUDIT_CATEGORIES[category]);
  if (board) q = q.eq("board_id", board);
  if (before) q = q.lt("id", before);

  const [{ data, error }, { data: boards }] = await Promise.all([
    q,
    db.from("boards").select("id, title, streamer_name").order("streamer_name").order("title"),
  ]);
  if (error) throw new Error("Could not load the audit log");

  const rows = (data ?? []) as Row[];
  const entries: AuditEntry[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: String(r.id),
    at: r.created_at,
    actorType: r.actor_type,
    actorName: r.actor_name,
    action: r.action,
    boardTitle: r.board_title,
    targetId: r.target_id,
    targetName: r.target_name,
    details: r.details ?? {},
    ipHash: r.ip_hash,
  }));

  return (
    <AuditLog
      entries={entries}
      category={category}
      board={board}
      boards={(boards ?? []).map((b) => ({ id: b.id as string, label: b.streamer_name ? `${b.streamer_name} · ${b.title}` : (b.title as string) }))}
      nextBefore={rows.length > PAGE_SIZE ? entries[entries.length - 1].id : null}
      paged={!!before}
      days={AUDIT_DAYS - 1}
      categories={["all", ...Object.keys(AUDIT_CATEGORIES)]}
    />
  );
}
