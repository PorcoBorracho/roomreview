import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { LOGIN_RE } from "./slug";
import type { StreamerRef } from "./types";

export const STREAMER_COLS = "id, username, display_name, avatar_url, status";
export type StreamerRow = { id: string; username: string; display_name: string | null; avatar_url: string | null; status: StreamerRef["status"] };

export const toStreamer = (r: StreamerRow): StreamerRef => ({
  id: r.id,
  login: r.username,
  displayName: r.display_name || r.username,
  avatarUrl: r.avatar_url,
  status: r.status,
});

/** Streamer por su login de Twitch (cualquier estado: quien llama decide qué mostrar) */
export const getStreamerByLogin = cache(async (login: string): Promise<StreamerRef | null> => {
  const l = login.toLowerCase();
  if (!LOGIN_RE.test(l)) return null;
  const { data, error } = await supabaseAdmin().from("admins").select(STREAMER_COLS).eq("role", "streamer").eq("username", l).maybeSingle();
  if (error) throw new Error("Could not load streamer");
  return data ? toStreamer(data as StreamerRow) : null;
});

export type StreamerCard = StreamerRef & { boards: number; open: number };

/** Texto de búsqueda seguro para los filtros de PostgREST: letras, números, espacios, _ y - */
export function cleanSearch(q: string) {
  return q.normalize("NFKC").replace(/[^\p{L}\p{N} _\-]/gu, "").replace(/\s+/g, " ").slice(0, 40).trim();
}

/**
 * Búsqueda pública: streamers aprobados con al menos un board activo.
 * Sin texto, los que tienen boards abiertos (más recientes primero).
 */
export async function searchStreamers(q: string, limit = 24): Promise<StreamerCard[]> {
  const db = supabaseAdmin();
  const term = cleanSearch(q);
  let query = db.from("admins").select(STREAMER_COLS).eq("role", "streamer").eq("status", "active").limit(200);
  // term ya está saneado: sin comillas, comas, paréntesis, puntos ni %
  if (term) query = query.or(`username.ilike."%${term}%",display_name.ilike."%${term}%"`);
  const { data, error } = await query;
  if (error) throw new Error("Could not search streamers");
  const streamers = ((data ?? []) as StreamerRow[]).map(toStreamer);
  if (!streamers.length) return [];

  const { data: boards } = await db
    .from("boards")
    .select("streamer_id, submissions_open, updated_at")
    .eq("is_active", true)
    .in("streamer_id", streamers.map((s) => s.id));
  const stats = new Map<string, { boards: number; open: number; last: string }>();
  for (const b of boards ?? []) {
    const s = stats.get(b.streamer_id as string) ?? { boards: 0, open: 0, last: "" };
    s.boards++;
    if (b.submissions_open) s.open++;
    if ((b.updated_at as string) > s.last) s.last = b.updated_at as string;
    stats.set(b.streamer_id as string, s);
  }
  const lower = term.toLowerCase();
  return streamers
    .filter((s) => stats.has(s.id))
    .map((s) => ({ ...s, boards: stats.get(s.id)!.boards, open: stats.get(s.id)!.open, last: stats.get(s.id)!.last }))
    .sort((a, b) =>
      // Coincidencia exacta primero; después, los que tienen boards abiertos y los más recientes
      Number(b.login === lower) - Number(a.login === lower) || b.open - a.open || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(({ last: _last, ...s }) => s);
}

export type TeamMember = { id: string; username: string; status: "active" | "pending" | "expired"; addedAt: string };

/** Admins del equipo de cada streamer */
export async function teamsOf(streamerIds: string[]): Promise<Map<string, TeamMember[]>> {
  const map = new Map<string, TeamMember[]>();
  if (!streamerIds.length) return map;
  const { data } = await supabaseAdmin()
    .from("streamer_admins")
    .select("streamer_id, created_at, admin:admins!streamer_admins_admin_id_fkey(id, username, must_change_password, password_expires_at)")
    .in("streamer_id", streamerIds)
    .order("created_at");
  const now = Date.now();
  for (const r of (data ?? []) as unknown as {
    streamer_id: string; created_at: string;
    admin: { id: string; username: string; must_change_password: boolean; password_expires_at: string | null } | null;
  }[]) {
    if (!r.admin) continue;
    const list = map.get(r.streamer_id) ?? [];
    list.push({
      id: r.admin.id,
      username: r.admin.username,
      status: !r.admin.must_change_password
        ? "active"
        : r.admin.password_expires_at && new Date(r.admin.password_expires_at).getTime() > now ? "pending" : "expired",
      addedAt: r.created_at,
    });
    map.set(r.streamer_id, list);
  }
  return map;
}

export type StreamerAdminItem = StreamerRef & {
  createdAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
  boards: number;
  team: TeamMember[];
};

/** Lista completa para la página Streamers (Site Admins) */
export async function listStreamersForAdmin(): Promise<StreamerAdminItem[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("admins")
    .select(`${STREAMER_COLS}, created_at, approved_at, last_login_at`)
    .eq("role", "streamer")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Could not load streamers");
  const rows = (data ?? []) as (StreamerRow & { created_at: string; approved_at: string | null; last_login_at: string | null })[];
  const ids = rows.map((r) => r.id);
  const [teams, { data: boards }] = await Promise.all([
    teamsOf(ids),
    ids.length ? db.from("boards").select("streamer_id").in("streamer_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const counts = new Map<string, number>();
  for (const b of boards ?? []) counts.set(b.streamer_id as string, (counts.get(b.streamer_id as string) ?? 0) + 1);
  return rows.map((r) => ({
    ...toStreamer(r),
    createdAt: r.created_at,
    approvedAt: r.approved_at,
    lastLoginAt: r.last_login_at,
    boards: counts.get(r.id) ?? 0,
    team: teams.get(r.id) ?? [],
  }));
}
