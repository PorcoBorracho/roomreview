"use server";

import { revalidatePath } from "next/cache";
import { generateServerPassword, hashPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { AuthError, isSiteAdmin, requireAccount, type Account } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usernameSchema, uuidSchema } from "@/lib/validation";
import { OTP_HOURS } from "@/lib/accounts";
import { audit } from "@/lib/audit";

/** Los errores son claves del diccionario (sección "errors") */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guarded<R>(fn: (acc: Account) => Promise<R>): Promise<R | { ok: false; error: string }> {
  try {
    const acc = await requireAccount();
    if (!(await rateLimit(`streamers:${acc.id}`, 120, 3600))) return { ok: false, error: "rateLimited" };
    return await fn(acc);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "unauthorized" };
    throw e;
  }
}

const refresh = () => {
  revalidatePath("/streamers");
  revalidatePath("/team");
  revalidatePath("/admins");
};

async function loginOf(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("admins").select("username").eq("id", id).eq("role", "streamer").maybeSingle();
  return (data?.username as string | undefined) ?? null;
}

/* ---------------------- Solicitudes (Owner y Site Admins) ---------------------- */

type StreamerAction = "approve" | "reject" | "suspend" | "reactivate";

/**
 * Aprobar o rechazar una solicitud, suspender o reactivar un streamer.
 * Cada cambio es condicional al estado actual: dos clics simultáneos no se pisan.
 * Suspender corta su sesión al instante (la sesión solo vale con la cuenta activa) y oculta sus boards al público.
 */
export async function setStreamerStatus(id: string, action: StreamerAction): Promise<Result> {
  return guarded(async (acc) => {
    if (!isSiteAdmin(acc)) return { ok: false, error: "unauthorized" };
    if (!uuidSchema.safeParse(id).success || !["approve", "reject", "suspend", "reactivate"].includes(action)) {
      return { ok: false, error: "invalidData" };
    }
    const db = supabaseAdmin();
    const login = await loginOf(id);
    if (!login) return { ok: false, error: "streamerNotFound" };
    const now = new Date().toISOString();

    let changed: unknown[] | null = null;
    if (action === "reject") {
      ({ data: changed } = await db.from("admins").delete().eq("id", id).eq("role", "streamer").eq("status", "pending").select("id"));
    } else {
      const [from, to] = action === "approve" ? ["pending", "active"] : action === "suspend" ? ["active", "suspended"] : ["suspended", "active"];
      const extra = action === "approve" ? { approved_by: acc.id, approved_at: now } : {};
      ({ data: changed } = await db
        .from("admins")
        .update({ status: to, updated_at: now, ...extra })
        .eq("id", id)
        .eq("role", "streamer")
        .eq("status", from)
        .select("id"));
    }
    if (!changed?.length) return { ok: false, error: "streamerChanged" };

    const event = { approve: "streamer.approved", reject: "streamer.rejected", suspend: "streamer.suspended", reactivate: "streamer.reactivated" } as const;
    await audit(event[action], { target: { id, name: login } });
    refresh();
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/* ------------------------- Equipo de un streamer ------------------------- */

/** El propio streamer, o un Site Admin para cualquiera */
function canManageTeam(acc: Account, streamerId: string) {
  return isSiteAdmin(acc) || (acc.role === "streamer" && acc.id === streamerId);
}

function teamError(hint?: string): string {
  if (hint === "TEAM_FULL") return "teamFull";
  if (hint === "ALREADY") return "alreadyInTeam";
  if (hint === "NOT_ADMIN") return "notAnAdmin";
  if (hint === "NOT_STREAMER") return "streamerNotFound";
  return "db";
}

/** Añade un Admin que ya existe al equipo (por su nombre de usuario). Máximo 2, comprobado en la base de datos. */
export async function addTeamAdmin(streamerId: string, username: string): Promise<Result<{ username: string }>> {
  return guarded(async (acc) => {
    if (!uuidSchema.safeParse(streamerId).success) return { ok: false, error: "invalidData" };
    if (!canManageTeam(acc, streamerId)) return { ok: false, error: "unauthorized" };
    const u = usernameSchema.safeParse(username);
    if (!u.success) return { ok: false, error: "adminNotFound" };
    const db = supabaseAdmin();
    const { data: target } = await db.from("admins").select("id, username, role").eq("username", u.data).neq("role", "streamer").maybeSingle();
    if (!target) return { ok: false, error: "adminNotFound" };
    if (target.role !== "admin") return { ok: false, error: "notAnAdmin" };

    const { error } = await db.rpc("assign_streamer_admin", { p_streamer: streamerId, p_admin: target.id, p_actor: acc.id });
    if (error) return { ok: false, error: teamError(error.hint) };
    await audit("team.admin_added", { target: { id: target.id as string, name: target.username as string }, details: { streamer: (await loginOf(streamerId)) ?? "" } });
    refresh();
    return { ok: true, username: target.username as string };
  });
}

/** El streamer crea una cuenta Admin nueva para su equipo. Devuelve su contraseña de un solo uso (se muestra una vez). */
export async function createTeamAdmin(username: string): Promise<Result<{ username: string; password: string }>> {
  return guarded(async (acc) => {
    if (acc.role !== "streamer") return { ok: false, error: "unauthorized" };
    // Cuentas nuevas: pocas por streamer y día, aunque vacíe y rellene su equipo
    if (!(await rateLimit(`team-create:${acc.id}`, 4, 24 * 3600))) return { ok: false, error: "rateLimited" };
    const u = usernameSchema.safeParse(username);
    if (!u.success) return { ok: false, error: "usernameInvalid" };
    const password = generateServerPassword();
    const { data: id, error } = await supabaseAdmin().rpc("streamer_create_admin", {
      p_streamer: acc.id,
      p_username: u.data,
      p_hash: await hashPassword(password),
      p_expires: new Date(Date.now() + OTP_HOURS * 3600 * 1000).toISOString(),
    });
    if (error) return { ok: false, error: error.code === "23505" ? "usernameTaken" : teamError(error.hint) };
    await audit("team.admin_created", { target: { id: id as string, name: u.data }, details: { streamer: acc.username } });
    refresh();
    return { ok: true, username: u.data, password };
  });
}

/** Saca a un Admin del equipo (su cuenta sigue existiendo). */
export async function removeTeamAdmin(streamerId: string, adminId: string): Promise<Result> {
  return guarded(async (acc) => {
    if (!uuidSchema.safeParse(streamerId).success || !uuidSchema.safeParse(adminId).success) return { ok: false, error: "invalidData" };
    if (!canManageTeam(acc, streamerId)) return { ok: false, error: "unauthorized" };
    const db = supabaseAdmin();
    const { data: removed, error } = await db.from("streamer_admins").delete().eq("streamer_id", streamerId).eq("admin_id", adminId).select("admin_id");
    if (error) return { ok: false, error: "db" };
    if (removed?.length) {
      const { data: who } = await db.from("admins").select("username").eq("id", adminId).maybeSingle();
      await audit("team.admin_removed", { target: { id: adminId, name: (who?.username as string | undefined) ?? null }, details: { streamer: (await loginOf(streamerId)) ?? "" } });
    }
    refresh();
    return { ok: true };
  });
}
