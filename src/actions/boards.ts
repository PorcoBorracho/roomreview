"use server";

import { revalidatePath } from "next/cache";
import { boardSchema, createBoardSchema, streamerPasswordSchema, uuidSchema, type BoardInput, type CreateBoardInput } from "@/lib/validation";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { requireAdmin } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { removeObjects } from "@/lib/media";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard(): Promise<Result | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
}

function dbError(e: { code?: string; message?: string }): string {
  if (e.code === "23505") return "That address is already used by another board.";
  if (e.code === "23514") return "Some values aren't valid. Check the address and title.";
  console.error("boards", e.message);
  return "Database error. Please try again.";
}

const toRow = (b: ReturnType<typeof boardSchema.parse>) => ({
  streamer_name: b.streamerName,
  platform: b.platform,
  title: b.title,
  slug: b.slug,
  description: b.description,
  is_active: b.isActive,
  submissions_open: b.submissionsOpen,
  people_allowed: b.peopleAllowed,
});

export async function createBoard(input: CreateBoardInput): Promise<Result<{ slug: string }>> {
  const g = await guard();
  if (g) return g as Result<{ slug: string }>;
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const pw = parsed.data.streamerPassword;
  if (await verifyPassword(pw, serverEnv.adminPasswordHash)) {
    return { ok: false, error: "The streamer password can't be the same as the admin password." };
  }

  const { error } = await supabaseAdmin().from("boards").insert({
    ...toRow(parsed.data),
    streamer_password_hash: await hashPassword(pw),
    streamer_password_enc: encryptSecret(pw),
  });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: true, slug: parsed.data.slug };
}

/**
 * Edición con control optimista: si otro admin guardó cambios desde que abriste
 * el formulario, no se sobrescriben y se avisa.
 */
export async function updateBoard(id: string, input: BoardInput, expectedUpdatedAt: string): Promise<Result<{ slug: string }>> {
  const g = await guard();
  if (g) return g as Result<{ slug: string }>;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid board" };
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const { data, error } = await supabaseAdmin()
    .from("boards")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "Another admin changed this board while you were editing. Close and reopen it to see the latest version." };
  }
  revalidatePath("/", "layout");
  return { ok: true, slug: parsed.data.slug };
}

/** Interruptores del panel: asignan un valor (idempotente), así que dos clics simultáneos no se contradicen. */
export async function setBoardFlag(id: string, flag: "isActive" | "submissionsOpen", value: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  if (!uuidSchema.safeParse(id).success || typeof value !== "boolean") return { ok: false, error: "Invalid request" };
  const column = flag === "isActive" ? "is_active" : "submissions_open";
  const { data, error } = await supabaseAdmin()
    .from("boards")
    .update({ [column]: value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data || data.length === 0) return { ok: false, error: "This board no longer exists." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Borra el board, todas sus entregas y todas sus fotos. */
export async function deleteBoard(id: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid board" };
  const db = supabaseAdmin();

  const { data: subs } = await db.from("submissions").select("id").eq("board_id", id);
  const ids = (subs ?? []).map((s) => s.id as string);
  const paths: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: media } = await db.from("submission_media").select("storage_path").in("submission_id", ids.slice(i, i + 200));
    paths.push(...(media ?? []).map((m) => m.storage_path as string));
  }

  const { data, error } = await db.from("boards").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data || data.length === 0) return { ok: false, error: "This board no longer exists." };

  await removeObjects(paths);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Devuelve la contraseña de streamer para copiarla. Solo admins; no se puede cambiar desde aquí. */
export async function revealBoardPassword(id: string): Promise<Result<{ password: string }>> {
  const g = await guard();
  if (g) return g as Result<{ password: string }>;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid board" };
  if (!(await rateLimit("reveal-password", 120, 3600))) return { ok: false, error: "Too many requests. Try again later." };
  const { data } = await supabaseAdmin().from("boards").select("streamer_password_enc").eq("id", id).maybeSingle();
  if (!data?.streamer_password_enc) return { ok: false, error: "This board has no streamer password yet." };
  const password = decryptSecret(data.streamer_password_enc as string);
  if (!password) {
    return { ok: false, error: "This password can't be decrypted (SESSION_SECRET changed). It still works for signing in." };
  }
  return { ok: true, password };
}

/** Solo para boards creados antes de que existieran contraseñas: se puede poner una vez. */
export async function setMissingBoardPassword(id: string, password: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Invalid board" };
  const parsed = streamerPasswordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password" };
  if (await verifyPassword(parsed.data, serverEnv.adminPasswordHash)) {
    return { ok: false, error: "The streamer password can't be the same as the admin password." };
  }
  const { data, error } = await supabaseAdmin()
    .from("boards")
    .update({ streamer_password_hash: await hashPassword(parsed.data), streamer_password_enc: encryptSecret(parsed.data) })
    .eq("id", id)
    .is("streamer_password_hash", null)
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data || data.length === 0) return { ok: false, error: "This board already has a streamer password." };
  revalidatePath("/", "layout");
  return { ok: true };
}
