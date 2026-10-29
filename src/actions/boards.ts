"use server";

import { revalidatePath } from "next/cache";
import {
  boardSchema, createBoardSchema, firstError, usernameSchema, uuidSchema,
  type BoardInput, type CreateBoardInput,
} from "@/lib/validation";
import { decryptSecret, encryptSecret, generateServerPassword, hashPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { AuthError, requireAccount, requireBoard } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { removeObjects } from "@/lib/media";
import { audit, boardRef } from "@/lib/audit";

/** Los errores son claves del diccionario (sección "errors") */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type PasswordKind = "streamer" | "moderator";

/** Ejecuta la acción solo si la sesión tiene el permiso; cualquier fallo de permisos → "unauthorized" */
async function guarded<R>(fn: () => Promise<R>): Promise<R | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "unauthorized" };
    throw e;
  }
}

function dbError(e: { code?: string; message?: string }): string {
  if (e.code === "23505") return "slugTaken";
  if (e.code === "23514") return "slugInvalid";
  console.error("boards", e.message);
  return "db";
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

const refresh = () => revalidatePath("/", "layout");

/** Nombre de cada columna en el registro de auditoría (coincide con los campos del formulario) */
const FIELD_NAMES = {
  streamer_name: "streamerName",
  platform: "platform",
  title: "title",
  slug: "slug",
  description: "description",
  is_active: "isActive",
  submissions_open: "submissionsOpen",
  people_allowed: "peopleAllowed",
} as const;

/** Cualquier cuenta puede crear boards; queda como dueña. */
export async function createBoard(input: CreateBoardInput): Promise<Result<{ slug: string }>> {
  return guarded(async () => {
    const acc = await requireAccount();
    if (!(await rateLimit(`create-board:${acc.id}`, 30, 3600))) return { ok: false, error: "rateLimited" };
    const parsed = createBoardSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { streamerPassword: sp, moderatorPassword: mp } = parsed.data;

    const [sh, mh] = await Promise.all([hashPassword(sp), hashPassword(mp)]);
    const { data: created, error } = await supabaseAdmin().from("boards").insert({
      ...toRow(parsed.data),
      owner_id: acc.id,
      streamer_password_hash: sh,
      streamer_password_enc: encryptSecret(sp),
      moderator_password_hash: mh,
      moderator_password_enc: encryptSecret(mp),
    }).select("id").single();
    if (error) return { ok: false, error: dbError(error) };
    await audit("board.created", { board: { id: created.id as string, title: parsed.data.title }, details: { slug: parsed.data.slug } });
    refresh();
    return { ok: true, slug: parsed.data.slug };
  });
}

/**
 * Edición con control optimista: si otra persona guardó cambios desde que abriste
 * el formulario, no se sobrescriben y se avisa.
 */
export async function updateBoard(id: string, input: BoardInput, expectedUpdatedAt: string): Promise<Result<{ slug: string }>> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success || typeof expectedUpdatedAt !== "string") return { ok: false, error: "invalidData" };
    await requireBoard(id, "manage");
    const parsed = boardSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const row = toRow(parsed.data);
    const { data: before } = await supabaseAdmin().from("boards").select(Object.keys(row).join(", ")).eq("id", id).maybeSingle();

    const { data, error } = await supabaseAdmin()
      .from("boards")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!data || data.length === 0) return { ok: false, error: "boardConflict" };
    // Qué campos han cambiado (sin guardar los valores: el registro dice qué se tocó, no el contenido)
    const old = (before ?? {}) as unknown as Record<string, unknown>;
    const fields = (Object.keys(row) as (keyof typeof row)[]).filter((k) => old[k] !== row[k]).map((k) => FIELD_NAMES[k]);
    if (fields.length) await audit("board.updated", { board: { id, title: parsed.data.title }, details: { fields } });
    refresh();
    return { ok: true, slug: parsed.data.slug };
  });
}

/** Interruptores del panel: asignan un valor (idempotente), así que dos clics simultáneos no se contradicen. */
export async function setBoardFlag(id: string, flag: "isActive" | "submissionsOpen", value: boolean): Promise<Result> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success || typeof value !== "boolean" || (flag !== "isActive" && flag !== "submissionsOpen")) {
      return { ok: false, error: "invalidData" };
    }
    await requireBoard(id, "manage");
    const column = flag === "isActive" ? "is_active" : "submissions_open";
    const { data, error } = await supabaseAdmin()
      .from("boards")
      .update({ [column]: value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!data || data.length === 0) return { ok: false, error: "boardNotFound" };
    await audit("board.flag_changed", { board: await boardRef(id), details: { flag, value } });
    refresh();
    return { ok: true };
  });
}

/** Borra el board, todas sus entregas y todas sus fotos. Solo el dueño o un Site Admin. */
export async function deleteBoard(id: string): Promise<Result> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
    await requireBoard(id, "own");
    const db = supabaseAdmin();
    const ref = await boardRef(id);

    const { data: subs } = await db.from("submissions").select("id").eq("board_id", id);
    const ids = (subs ?? []).map((s) => s.id as string);
    const paths: string[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: media } = await db.from("submission_media").select("storage_path").in("submission_id", ids.slice(i, i + 200));
      paths.push(...(media ?? []).map((m) => m.storage_path as string));
    }

    const { data, error } = await db.from("boards").delete().eq("id", id).select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!data || data.length === 0) return { ok: false, error: "boardNotFound" };

    await removeObjects(paths);
    await audit("board.deleted", { board: ref, details: { submissions: ids.length } });
    refresh();
    return { ok: true };
  });
}

/* ---------------------------- Contraseñas ---------------------------- */

const ENC_COLUMN: Record<PasswordKind, "streamer_password_enc" | "moderator_password_enc"> = {
  streamer: "streamer_password_enc",
  moderator: "moderator_password_enc",
};

const isKind = (k: unknown): k is PasswordKind => k === "streamer" || k === "moderator";

/** Devuelve una contraseña del board para copiarla. Quien gestiona el board. */
export async function revealBoardPassword(id: string, kind: PasswordKind): Promise<Result<{ password: string }>> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success || !isKind(kind)) return { ok: false, error: "invalidData" };
    await requireBoard(id, "manage");
    const acc = await requireAccount();
    if (!(await rateLimit(`reveal-password:${acc.id}`, 120, 3600))) return { ok: false, error: "rateLimited" };
    const col = ENC_COLUMN[kind];
    const { data } = await supabaseAdmin().from("boards").select(col).eq("id", id).maybeSingle();
    const enc = (data as Record<string, string | null> | null)?.[col];
    if (!enc) return { ok: false, error: "noPassword" };
    const password = decryptSecret(enc);
    if (!password) return { ok: false, error: "cantDecrypt" };
    await audit("board.password_viewed", { board: await boardRef(id), details: { kind } });
    return { ok: true, password };
  });
}

/**
 * Crea una contraseña nueva (generada en el servidor) y sube su versión en la misma operación:
 * quien entró con la anterior pierde el acceso al instante. Sirve para revocar.
 */
export async function regenerateBoardPassword(id: string, kind: PasswordKind): Promise<Result<{ password: string }>> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success || !isKind(kind)) return { ok: false, error: "invalidData" };
    await requireBoard(id, "manage");
    const acc = await requireAccount();
    if (!(await rateLimit(`rotate-password:${acc.id}`, 30, 3600))) return { ok: false, error: "rateLimited" };
    const password = generateServerPassword();
    const { error } = await supabaseAdmin().rpc("rotate_board_password", {
      p_board: id, p_kind: kind, p_hash: await hashPassword(password), p_enc: encryptSecret(password),
    });
    if (error) return { ok: false, error: error.hint === "NOT_FOUND" ? "boardNotFound" : "db" };
    await audit("board.password_regenerated", { board: await boardRef(id), details: { kind } });
    refresh();
    return { ok: true, password };
  });
}

/* ----------------------------- Compartir ----------------------------- */

/** Comparte el board con otro admin por su nombre de usuario. Solo el dueño o un Site Admin. */
export async function shareBoard(id: string, username: string): Promise<Result<{ member: { id: string; username: string } }>> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
    await requireBoard(id, "own");
    const acc = await requireAccount();
    if (!(await rateLimit(`share:${acc.id}`, 60, 3600))) return { ok: false, error: "rateLimited" };
    const u = usernameSchema.safeParse(username);
    if (!u.success) return { ok: false, error: "adminNotFound" };

    const db = supabaseAdmin();
    const [{ data: target }, { data: board }] = await Promise.all([
      db.from("admins").select("id, username").eq("username", u.data).maybeSingle(),
      db.from("boards").select("owner_id").eq("id", id).maybeSingle(),
    ]);
    if (!board) return { ok: false, error: "boardNotFound" };
    if (!target) return { ok: false, error: "adminNotFound" };
    if (target.id === board.owner_id) return { ok: false, error: "shareSelf" };

    const { error } = await db.from("board_members").insert({ board_id: id, admin_id: target.id, added_by: acc.id });
    if (error) return { ok: false, error: error.code === "23505" ? "alreadyShared" : error.code === "23503" ? "boardNotFound" : "db" };
    await audit("board.shared", { board: await boardRef(id), target: { id: target.id as string, name: target.username as string } });
    refresh();
    return { ok: true, member: { id: target.id as string, username: target.username as string } };
  });
}

export async function unshareBoard(id: string, adminId: string): Promise<Result> {
  return guarded(async () => {
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(adminId).success) return { ok: false, error: "invalidData" };
    await requireBoard(id, "own");
    const { data: removed, error } = await supabaseAdmin().from("board_members").delete().eq("board_id", id).eq("admin_id", adminId).select("admin_id");
    if (error) return { ok: false, error: "db" };
    if (removed?.length) {
      const { data: who } = await supabaseAdmin().from("admins").select("username").eq("id", adminId).maybeSingle();
      await audit("board.unshared", { board: await boardRef(id), target: { id: adminId, name: (who?.username as string | undefined) ?? null } });
    }
    refresh();
    return { ok: true };
  });
}
