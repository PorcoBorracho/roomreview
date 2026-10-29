import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "./supabase-admin";
import { SLUG_RE } from "./slug";
import type { Board, BoardWithStats } from "./types";
import type { Platform } from "./platforms";
import type { Account } from "./session";

// Nunca se seleccionan aquí las contraseñas cifradas: solo las leen las acciones de copiar (con permiso)
const BASE = "id, slug, streamer_name, platform, title, description, is_active, submissions_open, people_allowed, created_at, updated_at, owner_id";
const COLUMNS = `${BASE}, has_s:streamer_password_hash, has_m:moderator_password_hash`;
const WITH_PEOPLE = `${COLUMNS}, owner:admins!boards_owner_id_fkey(username), members:board_members(admin:admins!board_members_admin_id_fkey(id, username))`;

type Row = {
  id: string; slug: string; streamer_name: string; platform: Platform; title: string; description: string;
  is_active: boolean; submissions_open: boolean; people_allowed: boolean;
  created_at: string; updated_at: string; owner_id: string | null;
  has_s: string | null; has_m: string | null;
  owner?: { username: string } | null;
  members?: { admin: { id: string; username: string } | null }[];
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
  hasStreamerPassword: !!r.has_s,
  hasModeratorPassword: !!r.has_m,
  ownerId: r.owner_id,
  ownerName: r.owner?.username ?? null,
  members: (r.members ?? [])
    .map((m) => m.admin)
    .filter((a): a is { id: string; username: string } => !!a)
    .sort((a, b) => a.username.localeCompare(b.username)),
});

/** Un board por su URL (cacheado durante la petición: layout y página comparten la consulta). */
export const getBoardBySlug = cache(async (slug: string): Promise<Board | null> => {
  if (!SLUG_RE.test(slug) || slug.length > 48) return null;
  const { data, error } = await supabaseAdmin().from("boards").select(COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error("Could not load board");
  return data ? toBoard(data as unknown as Row) : null;
});

/** Ids de los boards compartidos con una cuenta */
async function memberBoardIds(adminId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("board_members").select("board_id").eq("admin_id", adminId);
  return (data ?? []).map((r) => r.board_id as string);
}

/** Boards que puede gestionar la cuenta: todos (Site Admin) o los suyos y los compartidos con ella. */
export async function listBoardsWithStats(account: Account): Promise<BoardWithStats[]> {
  const db = supabaseAdmin();
  let q = db.from("boards").select(WITH_PEOPLE).order("streamer_name", { ascending: true }).order("created_at", { ascending: true });
  if (account.role !== "site_admin") {
    const ids = await memberBoardIds(account.id);
    q = ids.length ? q.or(`owner_id.eq.${account.id},id.in.(${ids.join(",")})`) : q.eq("owner_id", account.id);
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
