"use server";

import { revalidatePath } from "next/cache";
import { uuidSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { removeObjects } from "@/lib/media";

type Result = { ok: true } | { ok: false; error: string };

async function guard(id: string): Promise<Result | null> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid ID" };
  return null;
}

/** Cambio de estado condicional: si otro admin ya lo cambió, no se pisa. */
async function transition(id: string, from: "pending" | "approved", to: "pending" | "approved"): Promise<Result> {
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .update({ status: to, reviewed_at: to === "approved" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) return { ok: false, error: "Database error" };
  if (!data || data.length === 0) return { ok: false, error: "Another admin already changed this submission. The list has been refreshed." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function approveSubmission(id: string): Promise<Result> {
  return (await guard(id)) ?? transition(id, "pending", "approved");
}

export async function unapproveSubmission(id: string): Promise<Result> {
  return (await guard(id)) ?? transition(id, "approved", "pending");
}

export async function deleteSubmission(id: string): Promise<Result> {
  const g = await guard(id);
  if (g) return g;
  const db = supabaseAdmin();

  // Borrado atómico: la primera petición se lleva las rutas; las siguientes no encuentran nada
  const { data: media } = await db.from("submission_media").select("storage_path").eq("submission_id", id);
  const { data: deleted, error } = await db
    .from("submissions")
    .delete()
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .select("id");
  if (error) return { ok: false, error: "Database error" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "This submission no longer exists" };

  await removeObjects((media ?? []).map((m) => m.storage_path));
  revalidatePath("/", "layout");
  return { ok: true };
}
