import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/** Horas que vale una contraseña de un solo uso */
export const OTP_HOURS = 72;

/** ¿Existe ya el Owner (o cualquier cuenta del equipo)? Mientras no, solo está disponible /setup. */
export async function hasAnyAdmin(): Promise<boolean> {
  const { count, error } = await supabaseAdmin().from("admins").select("id", { count: "exact", head: true }).neq("role", "streamer");
  if (error) throw new Error("Could not check admins");
  return (count ?? 0) > 0;
}

export type AdminListItem = {
  id: string;
  username: string;
  role: "owner" | "admin" | "site_admin";
  status: "active" | "pending" | "expired";
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  boards: number;
  /** Streamers de cuyo equipo forma parte */
  streamers: { id: string; login: string }[];
};

/** Cuentas del equipo (sin streamers): Owner primero, luego Site Admins y Admins */
export async function listAdmins(): Promise<AdminListItem[]> {
  const db = supabaseAdmin();
  const [{ data, error }, { data: owned }, { data: teams }] = await Promise.all([
    db
      .from("admins")
      .select("id, username, role, must_change_password, password_expires_at, totp_enabled_at, last_login_at, created_at")
      .neq("role", "streamer")
      .order("username"),
    db.from("boards").select("owner_id").not("owner_id", "is", null),
    db.from("streamer_admins").select("admin_id, streamer:admins!streamer_admins_streamer_id_fkey(id, username)"),
  ]);
  if (error) throw new Error("Could not load admins");
  const counts = new Map<string, number>();
  for (const b of owned ?? []) counts.set(b.owner_id as string, (counts.get(b.owner_id as string) ?? 0) + 1);
  const streamersOf = new Map<string, { id: string; login: string }[]>();
  for (const t of (teams ?? []) as unknown as { admin_id: string; streamer: { id: string; username: string } | null }[]) {
    if (!t.streamer) continue;
    streamersOf.set(t.admin_id, [...(streamersOf.get(t.admin_id) ?? []), { id: t.streamer.id, login: t.streamer.username }]);
  }
  const rank = { owner: 0, site_admin: 1, admin: 2 } as const;
  const now = Date.now();
  return (data ?? [])
    .map((r) => ({
      id: r.id as string,
      username: r.username as string,
      role: r.role as AdminListItem["role"],
      status: (!r.must_change_password
        ? "active"
        : r.password_expires_at && new Date(r.password_expires_at as string).getTime() > now
          ? "pending"
          : "expired") as AdminListItem["status"],
      totpEnabled: !!r.totp_enabled_at,
      lastLoginAt: (r.last_login_at as string | null) ?? null,
      createdAt: r.created_at as string,
      boards: counts.get(r.id as string) ?? 0,
      streamers: streamersOf.get(r.id as string) ?? [],
    }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.username.localeCompare(b.username));
}
