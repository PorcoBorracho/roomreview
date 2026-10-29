"use server";

import { deletionCodeSchema } from "@/lib/validation";
import { hashDeletionCode } from "@/lib/deletion-code";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { removeObjects } from "@/lib/media";
import { BUCKET } from "@/lib/limits";
import { revalidatePath } from "next/cache";
import { audit, boardRef } from "@/lib/audit";

/** error: clave del diccionario (sección "errors") */
export type DeleteState = { ok?: boolean; error?: string };

/** Derecho de supresión (RGPD art. 17) sin necesidad de cuenta: con el código recibido al enviar. */
export async function deleteOwnSubmission(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (!(await rateLimit(await clientKey("self-delete"), 10, 3600))) {
    return { error: "rateLimited" };
  }
  const parsed = deletionCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { error: "codeInvalid" };

  const db = supabaseAdmin();
  const { data: rows, error } = await db
    .from("submissions")
    .delete()
    .eq("deletion_token_hash", hashDeletionCode(parsed.data))
    .select("id, board_id");
  if (error) return { error: "db" };
  // Misma respuesta exista o no, para no revelar si un código es válido
  for (const r of rows ?? []) {
    const { data: files } = await db.storage.from(BUCKET).list(r.id, { limit: 50 });
    await removeObjects((files ?? []).map((f) => `${r.id}/${f.name}`));
    // Ejercicio del derecho de supresión: queda constancia de que se hizo, sin datos de la persona
    await audit("submission.self_deleted", { actor: { type: "visitor" }, board: await boardRef(r.board_id as string), target: { id: r.id as string } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
