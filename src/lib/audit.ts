import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { hmac } from "./crypto";
import { clientIp } from "./request";
import { getSession } from "./session";

/**
 * Registro de auditoría (tabla audit_log, solo se puede añadir).
 * Nunca se registra nada de quien envía fotos: ni email ni usuario, solo el id de la entrega.
 * Si falla el registro, la acción no se interrumpe: se anota el error en los logs del servidor.
 */
export const AUDIT_ACTIONS = [
  // Inicio de sesión
  "account.login", "account.login_failed", "account.mfa_failed", "board.login", "board.login_failed", "setup.completed",
  // Cuenta propia
  "account.password_changed", "account.totp_enabled", "account.totp_disabled",
  // Cuentas (Site Admin)
  "admin.created", "admin.password_reset", "admin.role_changed", "admin.deleted",
  // Boards
  "board.created", "board.updated", "board.flag_changed", "board.deleted",
  "board.password_viewed", "board.password_regenerated", "board.shared", "board.unshared",
  // Moderación
  "submission.approved", "submission.unapproved", "submission.deleted", "submission.self_deleted",
  // Problemas reportados
  "report.resolved", "report.reopened", "report.deleted",
  // Tareas automáticas
  "system.cleanup",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_CATEGORIES: Record<string, string[]> = {
  signin: ["account.login", "account.login_failed", "account.mfa_failed", "board.login", "board.login_failed", "setup.completed"],
  accounts: ["account.password_changed", "account.totp_enabled", "account.totp_disabled", "admin.created", "admin.password_reset", "admin.role_changed", "admin.deleted"],
  boards: ["board.created", "board.updated", "board.flag_changed", "board.deleted", "board.password_viewed", "board.password_regenerated", "board.shared", "board.unshared"],
  moderation: ["submission.approved", "submission.unapproved", "submission.deleted", "submission.self_deleted"],
  problems: ["report.resolved", "report.reopened", "report.deleted"],
  system: ["system.cleanup"],
};

export type AuditActor =
  | { type: "account"; id: string; name: string }
  | { type: "moderator" | "streamer" | "visitor" | "system" };

type Details = Record<string, string | number | boolean | string[]>;

type Entry = {
  board?: { id: string; title: string } | null;
  target?: { id?: string | null; name?: string | null };
  details?: Details;
  /** Por defecto se deduce de la sesión de la petición */
  actor?: AuditActor;
};

/** Quién hace la acción según la sesión: la cuenta; si no, el permiso de ese board; si no, un visitante. */
async function actorFromSession(boardId?: string): Promise<AuditActor> {
  const s = await getSession();
  if (s.account) return { type: "account", id: s.account.id, name: s.account.username };
  if (boardId) {
    if (s.grants.some((g) => g.boardId === boardId && g.kind === "moderator")) return { type: "moderator" };
    if (s.grants.some((g) => g.boardId === boardId && g.kind === "streamer")) return { type: "streamer" };
  }
  return { type: "visitor" };
}

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

export async function audit(action: AuditAction, entry: Entry = {}): Promise<void> {
  try {
    const actor = entry.actor ?? (await actorFromSession(entry.board?.id));
    const ip = actor.type === "system" ? null : await clientIp().catch(() => "unknown");
    const { error } = await supabaseAdmin().from("audit_log").insert({
      actor_type: actor.type,
      actor_id: actor.type === "account" ? actor.id : null,
      actor_name: actor.type === "account" ? actor.name.slice(0, 64) : "",
      action,
      board_id: entry.board?.id ?? null,
      board_title: entry.board?.title.slice(0, 80) ?? "",
      target_id: clip(entry.target?.id, 64),
      target_name: clip(entry.target?.name, 64),
      details: entry.details ?? {},
      // Seudonimizada (HMAC con clave): permite ver que dos intentos vienen de la misma conexión, no quién es
      ip_hash: ip && ip !== "unknown" ? hmac(`audit:${ip}`).slice(0, 16) : null,
    });
    if (error) console.error("audit", action, error.message);
  } catch (e) {
    console.error("audit", action, e);
  }
}

/** Título del board para el registro (se guarda una copia por si luego se borra) */
export async function boardRef(id: string): Promise<{ id: string; title: string } | null> {
  const { data } = await supabaseAdmin().from("boards").select("id, title").eq("id", id).maybeSingle();
  return data ? { id: data.id as string, title: data.title as string } : null;
}
