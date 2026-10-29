import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBoardBySlug } from "@/lib/boards";
import { signPaths } from "@/lib/media";
import AdminQueue from "@/components/AdminQueue";
import type { AdminSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

type Row = {
  id: string; username: string; email: string; country: string; description: string;
  status: "pending" | "approved"; submitted_at: string;
  submission_media: { id: string; storage_path: string; position: number }[];
};

function sanitizeSearch(q: string) {
  // Solo caracteres seguros para el filtro (evita inyección en la sintaxis de PostgREST)
  return q.normalize("NFKC").replace(/[^\p{L}\p{N} _.\-@]/gu, "").slice(0, 60).trim();
}

export default async function QueuePage({
  params,
  searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { slug } = await params;
  await requireAdminPage(`/${slug}/queue`);
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const sp = await searchParams;
  const status = sp.status === "approved" || sp.status === "all" ? sp.status : "pending";
  const q = sanitizeSearch(sp.q ?? "");
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1));

  const db = supabaseAdmin();
  let query = db
    .from("submissions")
    .select("id, username, email, country, description, status, submitted_at, submission_media(id, storage_path, position)", { count: "exact" })
    .eq("board_id", board.id)
    .neq("status", "uploading")
    .order("submitted_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    const pat = `%${q}%`; // q ya está saneado: sin comillas, comas, paréntesis ni %
    query = query.or(`username.ilike."${pat}",country.ilike."${pat}"`);
  }

  const [{ data, count, error }, totalRes] = await Promise.all([
    query,
    db.from("submissions").select("id", { count: "exact", head: true }).eq("board_id", board.id).neq("status", "uploading"),
  ]);
  if (error) throw new Error("Could not load submissions");

  const rows = (data ?? []) as Row[];
  const urls = await signPaths(rows.flatMap((r) => r.submission_media.map((m) => m.storage_path)));

  const submissions: AdminSubmission[] = rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    country: r.country,
    description: r.description,
    status: r.status,
    submittedAt: r.submitted_at,
    media: [...r.submission_media]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, url: urls.get(m.storage_path) ?? "" }))
      .filter((m) => m.url),
  }));

  return (
    <AdminQueue
      submissions={submissions}
      filtered={count ?? 0}
      total={totalRes.count ?? 0}
      status={status}
      q={q}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}
