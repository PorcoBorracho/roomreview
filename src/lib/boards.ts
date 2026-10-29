import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { SLUG_RE } from "./slug";
import type { Board, BoardWithStats } from "./types";
import type { Platform } from "./platforms";

// Nunca se selecciona streamer_password_enc aquí: solo lo lee la acción de copiar (admin)
const COLUMNS = "id, slug, streamer_name, platform, title, description, is_active, submissions_open, people_allowed, created_at, updated_at, has_password:streamer_password_hash";

type Row = {
  id: string; slug: string; streamer_name: string; platform: Platform; title: string; description: string;
  is_active: boolean; submissions_open: boolean; people_allowed: boolean;
  created_at: string; updated_at: string; has_password: string | null;
};

const toBoard = (r: Row): Board => ({
  id: r.id,
  slug: r.slug,
  streamerName: r.streamer_name,
  platform: r.platform,
  title: r.title,
  description: r.description,
  isActive: r.is_active,
  submissionsOpen: r.submissions_open,
  peopleAllowed: r.people_allowed,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  hasStreamerPassword: !!r.has_password,
});

/** Un board por su URL (cacheado durante la petición: layout y página comparten la consulta). */
export const getBoardBySlug = cache(async (slug: string): Promise<Board | null> => {
  if (!SLUG_RE.test(slug) || slug.length > 48) return null;
  const { data, error } = await supabaseAdmin().from("boards").select(COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error("Could not load board");
  return data ? toBoard(data as Row) : null;
});

export async function getBoardById(id: string): Promise<Board | null> {
  const { data } = await supabaseAdmin().from("boards").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toBoard(data as Row) : null;
}

export async function listBoardsWithStats(): Promise<BoardWithStats[]> {
  const db = supabaseAdmin();
  const [{ data, error }, { data: stats }] = await Promise.all([
    db.from("boards").select(COLUMNS).order("streamer_name", { ascending: true }).order("created_at", { ascending: true }),
    db.rpc("board_stats"),
  ]);
  if (error) throw new Error("Could not load boards");
  const byId = new Map(((stats ?? []) as { board_id: string; pending: number; approved: number }[]).map((s) => [s.board_id, s]));
  return ((data ?? []) as Row[]).map((r) => ({
    ...toBoard(r),
    pending: Number(byId.get(r.id)?.pending ?? 0),
    approved: Number(byId.get(r.id)?.approved ?? 0),
  }));
}

/** Hash de la contraseña de streamer de un board (solo para comprobar el login). */
export async function getBoardPasswordHash(boardId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("boards").select("streamer_password_hash").eq("id", boardId).maybeSingle();
  return (data?.streamer_password_hash as string | null) ?? null;
}
