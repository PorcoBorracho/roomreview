"use server";

import { deletionCodeSchema } from "@/lib/validation";
import { hashDeletionCode } from "@/lib/deletion-code";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { removeObjects } from "@/lib/media";
import { BUCKET } from "@/lib/env";
import { revalidatePath } from "next/cache";

export type DeleteState = { ok?: boolean; error?: string };

/** Derecho de supresión (RGPD art. 17) sin necesidad de cuenta: con el código recibido al enviar. */
export async function deleteOwnSubmission(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (!(await rateLimit(await clientKey("self-delete"), 10, 3600))) {
    return { error: "Too many attempts. Please try again in an hour, or contact us by email." };
  }
  const parsed = deletionCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const db = supabaseAdmin();
  const { data: rows, error } = await db
    .from("submissions")
    .delete()
    .eq("deletion_token_hash", hashDeletionCode(parsed.data))
    .select("id");
  if (error) return { error: "Something went wrong. Please try again or contact us by email." };
  // Misma respuesta exista o no, para no revelar si un código es válido
  for (const r of rows ?? []) {
    const { data: files } = await db.storage.from(BUCKET).list(r.id, { limit: 50 });
    await removeObjects((files ?? []).map((f) => `${r.id}/${f.name}`));
  }
  revalidatePath("/admin");
  revalidatePath("/streamer");
  return { ok: true };
}
