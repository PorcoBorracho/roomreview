import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { SLUG_RE } from "./slug";
import type { Board, BoardWithStats, StreamerRef } from "./types";
import { isSiteAdmin, type Account } from "./session";
import { getStreamerByLogin, STREAMER_COLS, toStreamer, type StreamerRow } from "./streamers";

// Nunca se seleccionan aquí las contraseñas cifradas: solo las leen las acciones de copiar (con permiso)
const BASE =
  "id, slug, title, description, is_active, submissions_open, people_allowed, blur_new, allow_videos, created_at, updated_at, owner_id, streamer_id";
const COLUMNS = `${BASE}, has_s:streamer_password_hash, has_m:moderator_password_hash, streamer:admins!boards_streamer_id_fkey(${STREAMER_COLS})`;
const WITH_PEOPLE = `${COLUMNS}, owner:admins!boards_owner_id_fkey(username), members:board_members(admin:admins!board_members_admin_id_fkey(id, username))`;

type Row = {
  id: string; slug: string; title: string; description: string;
  is_active: boolean; submissions_open: boolean; people_allowed: boolean; blur_new: boolean; allow_videos: boolean;
  created_at: string; updated_at: string; owner_id: string | null; streamer_id: string | null;
  has_s: string | null; has_m: string | null;
  streamer: StreamerRow | null;
  owner?: { username: string } | null;
  members?: { admin: { id: string; username: string } | null }[];
};

const toBoard = (r: Row): Board => ({
  id: r.id,
  slug: r.slug,
  streamer: r.streamer ? toStreamer(r.streamer) : null,
  title: r.title,
  description: r.description,
  isActive: r.is_active,
  submissionsOpen: r.submissions_open,
  peopleAllowed: r.people_allowed,
  blurNew: r.blur_new,
  allowVideos: r.allow_videos,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  hasStreamerPassword: !!r.has_s,
  hasModeratorPassword: !!r.has_m,
  ownerId: r.owner_id,
  ownerName: r.owner?.username ?? null,
  members: (r.members ?? [])
    .map((m) => m.admin)
    .filter((a): a is { id: string; username: string } => !!a)
    .sort((a, b) => a.username.localeCompare(b.username)),
});

/** Un board por su dirección /{streamer}/{board} (cacheado durante la petición: layout y página comparten la consulta). */
export const getBoard = cache(async (login: string, slug: string): Promise<Board | null> => {
  if (!SLUG_RE.test(slug) || slug.length > 48) return null;
  const streamer = await getStreamerByLogin(login);
  if (!streamer) return null;
  const { data, error } = await supabaseAdmin().from("boards").select(COLUMNS).eq("streamer_id", streamer.id).eq("slug", slug).maybeSingle();
  if (error) throw new Error("Could not load board");
  return data ? toBoard(data as unknown as Row) : null;
});

export const getBoardById = cache(async (id: string): Promise<Board | null> => {
  const { data } = await supabaseAdmin().from("boards").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toBoard(data as unknown as Row) : null;
});

/** El público solo ve boards activos de streamers activos */
export const isPublic = (b: Pick<Board, "isActive" | "streamer">) => b.isActive && b.streamer?.status === "active";

/** Boards activos de un streamer, para su página pública */
export async function listPublicBoards(streamerId: string): Promise<Board[]> {
  const { data, error } = await supabaseAdmin()
    .from("boards")
    .select(COLUMNS)
    .eq("streamer_id", streamerId)
    .eq("is_active", true)
    .order("submissions_open", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load boards");
  return ((data ?? []) as unknown as Row[]).map(toBoard);
}

/** Streamers de cuyo equipo forma parte un Admin */
export async function teamStreamerIds(adminId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("streamer_admins").select("streamer_id").eq("admin_id", adminId);
  return (data ?? []).map((r) => r.streamer_id as string);
}

/**
 * Boards del panel:
 *  · Owner / Site Admin: todos.
 *  · Admin: los que creó, los compartidos con él y los de los streamers de su equipo.
 *  · Streamer: los suyos.
 */
export async function listBoardsWithStats(account: Account): Promise<BoardWithStats[]> {
  const db = supabaseAdmin();
  let q = db.from("boards").select(WITH_PEOPLE).order("created_at", { ascending: true });
  if (account.role === "streamer") {
    q = q.eq("streamer_id", account.id);
  } else if (!isSiteAdmin(account)) {
    const [{ data: shared }, streamers] = await Promise.all([
      db.from("board_members").select("board_id").eq("admin_id", account.id),
      teamStreamerIds(account.id),
    ]);
    const ids = (shared ?? []).map((r) => r.board_id as string);
    // Solo uuids (vienen de la base de datos): seguros dentro del filtro
    const parts = [`owner_id.eq.${account.id}`];
    if (ids.length) parts.push(`id.in.(${ids.join(",")})`);
    if (streamers.length) parts.push(`streamer_id.in.(${streamers.join(",")})`);
    q = q.or(parts.join(","));
  }
  const [{ data, error }, { data: stats }] = await Promise.all([q, db.rpc("board_stats")]);
  if (error) {
    console.error("listBoards", error.message);
    throw new Error("Could not load boards");
  }
  const byId = new Map(((stats ?? []) as { board_id: string; pending: number; approved: number }[]).map((s) => [s.board_id, s]));
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...toBoard(r),
    pending: Number(byId.get(r.id)?.pending ?? 0),
    approved: Number(byId.get(r.id)?.approved ?? 0),
  }));
}

/**
 * Streamers para los que esta cuenta puede crear boards:
 *  · Owner / Site Admin: todos los aprobados.
 *  · Admin: los de su equipo.
 *  · Streamer: él mismo.
 */
export async function allowedStreamers(account: Account): Promise<StreamerRef[]> {
  const db = supabaseAdmin();
  let q = db.from("admins").select(STREAMER_COLS).eq("role", "streamer").eq("status", "active").order("username").limit(500);
  if (account.role === "streamer") q = q.eq("id", account.id);
  else if (!isSiteAdmin(account)) {
    const ids = await teamStreamerIds(account.id);
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
  const { data } = await q;
  return ((data ?? []) as unknown as StreamerRow[]).map(toStreamer);
}

export async function canUseStreamer(account: Account, streamerId: string): Promise<boolean> {
  return (await allowedStreamers(account)).some((s) => s.id === streamerId);
}

export type BoardSecrets = {
  streamerHash: string | null;
  moderatorHash: string | null;
  streamerVersion: number;
  moderatorVersion: number;
};

/** Hashes y versiones de las contraseñas de un board (solo para comprobar el login). */
export async function getBoardSecrets(boardId: string): Promise<BoardSecrets | null> {
  const { data } = await supabaseAdmin()
    .from("boards")
    .select("streamer_password_hash, moderator_password_hash, streamer_pw_version, moderator_pw_version")
    .eq("id", boardId)
    .maybeSingle();
  if (!data) return null;
  return {
    streamerHash: (data.streamer_password_hash as string | null) ?? null,
    moderatorHash: (data.moderator_password_hash as string | null) ?? null,
    streamerVersion: data.streamer_pw_version as number,
    moderatorVersion: data.moderator_pw_version as number,
  };
}
