"use server";

import { revalidatePath } from "next/cache";
import { uuidSchema } from "@/lib/validation";
import { AuthError, requireBoard } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { removeObjects } from "@/lib/media";
import { audit, boardRef } from "@/lib/audit";

/** Los errores son claves del diccionario (sección "errors") */
type Result = { ok: true } | { ok: false; error: string };

/**
 * Moderación de entregas: quien gestiona el board (dueño, compartido, Site Admin)
 * o tiene la contraseña de Board Admin de ESE board. Devuelve el board de la entrega.
 */
async function guard(id: string): Promise<{ boardId: string } | Result> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
  const { data } = await supabaseAdmin().from("submissions").select("board_id").eq("id", id).maybeSingle();
  // Sin revelar si existe a quien no tiene permiso: mismo error en ambos casos
  if (!data) return { ok: false, error: "submissionGone" };
  try {
    await requireBoard(data.board_id as string, "moderate");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "unauthorized" };
    throw e;
  }
  return { boardId: data.board_id as string };
}

/** Cambio de estado condicional: si otra persona ya lo cambió, no se pisa. */
async function transition(id: string, from: "pending" | "approved", to: "pending" | "approved"): Promise<Result> {
  const g = await guard(id);
  if ("ok" in g) return g;
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .update({ status: to, reviewed_at: to === "approved" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("board_id", g.boardId)
    .eq("status", from)
    .select("id");
  if (error) return { ok: false, error: "db" };
  if (!data || data.length === 0) return { ok: false, error: "submissionChanged" };
  // Solo el id de la entrega: nunca datos de quien la envió
  await audit(to === "approved" ? "submission.approved" : "submission.unapproved", { board: await boardRef(g.boardId), target: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function approveSubmission(id: string): Promise<Result> {
  return transition(id, "pending", "approved");
}

export async function unapproveSubmission(id: string): Promise<Result> {
  return transition(id, "approved", "pending");
}

export async function deleteSubmission(id: string): Promise<Result> {
  const g = await guard(id);
  if ("ok" in g) return g;
  const db = supabaseAdmin();

  // Borrado atómico: la primera petición se lleva las rutas; las siguientes no encuentran nada
  const { data: media } = await db.from("submission_media").select("storage_path").eq("submission_id", id);
  const { data: deleted, error } = await db
    .from("submissions")
    .delete()
    .eq("id", id)
    .eq("board_id", g.boardId)
    .in("status", ["pending", "approved"])
    .select("id");
  if (error) return { ok: false, error: "db" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "submissionGone" };

  await removeObjects((media ?? []).map((m) => m.storage_path));
  await audit("submission.deleted", { board: await boardRef(g.boardId), target: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}
