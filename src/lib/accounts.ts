import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/** Horas que vale una contraseña de un solo uso */
export const OTP_HOURS = 72;

/** ¿Existe ya alguna cuenta? Mientras no, solo está disponible /setup. */
export async function hasAnyAdmin(): Promise<boolean> {
  const { count, error } = await supabaseAdmin().from("admins").select("id", { count: "exact", head: true });
  if (error) throw new Error("Could not check admins");
  return (count ?? 0) > 0;
}

export type AdminListItem = {
  id: string;
  username: string;
  role: "admin" | "site_admin";
  status: "active" | "pending" | "expired";
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  boards: number;
};

export async function listAdmins(): Promise<AdminListItem[]> {
  const db = supabaseAdmin();
  const [{ data, error }, { data: owned }] = await Promise.all([
    db
      .from("admins")
      .select("id, username, role, must_change_password, password_expires_at, totp_enabled_at, last_login_at, created_at")
      .order("role", { ascending: false })
      .order("username"),
    db.from("boards").select("owner_id").not("owner_id", "is", null),
  ]);
  if (error) throw new Error("Could not load admins");
  const counts = new Map<string, number>();
  for (const b of owned ?? []) counts.set(b.owner_id as string, (counts.get(b.owner_id as string) ?? 0) + 1);
  const now = Date.now();
  return (data ?? []).map((r) => ({
    id: r.id as string,
    username: r.username as string,
    role: r.role as "admin" | "site_admin",
    status: !r.must_change_password
      ? "active"
      : r.password_expires_at && new Date(r.password_expires_at as string).getTime() > now
        ? "pending"
        : "expired",
    totpEnabled: !!r.totp_enabled_at,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
    createdAt: r.created_at as string,
    boards: counts.get(r.id as string) ?? 0,
  }));
}
