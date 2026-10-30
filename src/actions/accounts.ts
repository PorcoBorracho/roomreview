"use server";

import { revalidatePath } from "next/cache";
import { generateServerPassword, hashPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { AuthError, requireSiteAdmin } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usernameSchema, uuidSchema } from "@/lib/validation";
import { OTP_HOURS } from "@/lib/accounts";
import { audit } from "@/lib/audit";

/** Los errores son claves del diccionario (sección "errors") */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Nombre de una cuenta (antes de cambiarla o borrarla), para el registro */
async function usernameOf(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("admins").select("username").eq("id", id).maybeSingle();
  return (data?.username as string | undefined) ?? null;
}

/** Rol de una cuenta: el Owner y los streamers no se gestionan desde aquí */
async function roleOf(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("admins").select("role").eq("id", id).maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

async function siteAdmin<R>(fn: (actorId: string) => Promise<R>): Promise<R | { ok: false; error: string }> {
  try {
    const acc = await requireSiteAdmin();
    if (!(await rateLimit(`site-admin:${acc.id}`, 120, 3600))) return { ok: false, error: "rateLimited" };
    return await fn(acc.id);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "unauthorized" };
    throw e;
  }
}

const expiry = () => new Date(Date.now() + OTP_HOURS * 3600 * 1000).toISOString();
const refresh = () => revalidatePath("/admins");

/** Registro cerrado: solo un Site Admin crea cuentas. Devuelve la contraseña de un solo uso (se muestra una vez). */
export async function createAdmin(username: string, role: "admin" | "site_admin"): Promise<Result<{ password: string; username: string }>> {
  return siteAdmin(async (actorId) => {
    const u = usernameSchema.safeParse(username);
    if (!u.success) return { ok: false, error: "usernameInvalid" };
    if (role !== "admin" && role !== "site_admin") return { ok: false, error: "invalidData" };
    const password = generateServerPassword();
    const { data: created, error } = await supabaseAdmin().from("admins").insert({
      username: u.data,
      role,
      password_hash: await hashPassword(password),
      must_change_password: true,
      password_expires_at: expiry(),
      created_by: actorId,
    }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "usernameTaken" : "db" };
    await audit("admin.created", { target: { id: created.id as string, name: u.data }, details: { role } });
    refresh();
    return { ok: true, password, username: u.data };
  });
}

/**
 * Nueva contraseña de un solo uso para otra cuenta: cierra todas sus sesiones y quita su 2FA
 * (para el caso de que haya perdido el móvil). Para la tuya, usa "Cambiar contraseña".
 */
export async function resetAdminPassword(id: string): Promise<Result<{ password: string }>> {
  return siteAdmin(async (actorId) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
    if (id === actorId) return { ok: false, error: "resetSelf" };
    const role = await roleOf(id);
    if (!role) return { ok: false, error: "adminNotFound" };
    // La del Owner solo vuelve a la de configuración (desde su cuenta o con npm run reset-owner)
    if (role !== "admin" && role !== "site_admin") return { ok: false, error: "ownerProtected" };
    const password = generateServerPassword();
    const { error } = await supabaseAdmin().rpc("admin_set_password", {
      p_id: id, p_hash: await hashPassword(password), p_must_change: true, p_expires: expiry(), p_clear_totp: true,
    });
    if (error) return { ok: false, error: error.hint === "NOT_FOUND" ? "adminNotFound" : "db" };
    await audit("admin.password_reset", { target: { id, name: await usernameOf(id) } });
    refresh();
    return { ok: true, password };
  });
}

/** Dar o quitar el rol de Site Admin (el Owner no se puede cambiar; comprobado en la base de datos). */
export async function setAdminRole(id: string, role: "admin" | "site_admin"): Promise<Result> {
  return siteAdmin(async () => {
    if (!uuidSchema.safeParse(id).success || (role !== "admin" && role !== "site_admin")) return { ok: false, error: "invalidData" };
    const { error } = await supabaseAdmin().rpc("set_admin_role", { p_target: id, p_role: role });
    if (error) {
      if (error.hint === "LAST_SITE_ADMIN") return { ok: false, error: "lastSiteAdmin" };
      if (error.hint === "NOT_FOUND") return { ok: false, error: "adminNotFound" };
      if (error.hint === "PROTECTED") return { ok: false, error: "ownerProtected" };
      return { ok: false, error: "db" };
    }
    await audit("admin.role_changed", { target: { id, name: await usernameOf(id) }, details: { role } });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/** Borra una cuenta del equipo (nunca el Owner); sus boards pasan a quien la borra. */
export async function deleteAdmin(id: string): Promise<Result> {
  return siteAdmin(async (actorId) => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
    const name = await usernameOf(id);
    const { error } = await supabaseAdmin().rpc("delete_admin", { p_target: id, p_actor: actorId });
    if (error) {
      if (error.hint === "SELF") return { ok: false, error: "cantDeleteSelf" };
      if (error.hint === "NOT_FOUND") return { ok: false, error: "adminNotFound" };
      if (error.hint === "PROTECTED") return { ok: false, error: "ownerProtected" };
      return { ok: false, error: "db" };
    }
    await audit("admin.deleted", { target: { id, name } });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
