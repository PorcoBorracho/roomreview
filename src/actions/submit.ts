"use server";

import { randomUUID } from "node:crypto";
import { firstError, submissionSchema, uuidSchema, type SubmissionInput } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, clientKey } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { randomToken, sha256, safeEqual } from "@/lib/crypto";
import { BUCKET, MAX_FILE_BYTES, MAX_VIDEO_BYTES, isVideoType } from "@/lib/limits";
import { LEGAL } from "@/config/legal";
import { newDeletionCode } from "@/lib/deletion-code";
import { removeObjects, sniffImageType, sniffVideoType } from "@/lib/media";

type InitResult =
  | { ok: true; submissionId: string; finalizeToken: string; deletionCode: string; uploads: { path: string; token: string }[] }
  | { ok: false; error: string };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" };
const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 h para terminar la subida

/** Los errores son claves del diccionario (sección "errors"). Paso 1: valida, crea la entrega (estado "uploading") y devuelve URLs firmadas de un uso. */
export async function initSubmission(input: SubmissionInput): Promise<InitResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }
  const data = parsed.data;

  if (!(await rateLimit(await clientKey("submit"), 5, 3600))) {
    return { ok: false, error: "tooManySubmissions" };
  }
  if (!(await rateLimit("submit:global", 100, 3600))) {
    return { ok: false, error: "serviceBusy" };
  }
  if (!(await verifyTurnstile(data.turnstileToken, await clientIp(), "submit"))) {
    return { ok: false, error: "captchaFailed" };
  }

  const db = supabaseAdmin();
  const id = randomUUID();
  const finalizeToken = randomToken();
  const deletion = newDeletionCode();
  // Nombres de archivo aleatorios: nunca se usa el nombre original del usuario
  const media = data.files.map((f, i) => ({
    path: `${id}/${randomUUID()}.${EXT[f.type]}`,
    position: i,
    content_type: f.type,
  }));

  const { error } = await db.rpc("create_submission", {
    p_id: id,
    p_board_id: data.boardId,
    p_username: data.username,
    p_email: data.email,
    p_country: data.country,
    p_description: data.description,
    p_token_hash: sha256(finalizeToken),
    p_media: media,
    p_consent_version: LEGAL.policyVersion,
    p_deletion_hash: deletion.hash,
  });
  if (error) {
    if (error.hint === "BOARD_CLOSED" || error.message?.includes("board closed")) {
      return { ok: false, error: "boardClosed" };
    }
    if (error.hint === "VIDEOS_OFF") return { ok: false, error: "videosNotAllowed" };
    console.error("create_submission", error.message);
    return { ok: false, error: "db" };
  }

  const uploads: { path: string; token: string }[] = [];
  for (const m of media) {
    const { data: signed, error: signErr } = await db.storage.from(BUCKET).createSignedUploadUrl(m.path);
    if (signErr || !signed) {
      console.error("createSignedUploadUrl", signErr?.message);
      await db.from("submissions").delete().eq("id", id);
      return { ok: false, error: "db" };
    }
    uploads.push({ path: signed.path, token: signed.token });
  }

  return { ok: true, submissionId: id, finalizeToken, deletionCode: deletion.code, uploads };
}

type FinalizeResult = { ok: true } | { ok: false; error: string };

/** Paso 2: comprueba en el servidor que los archivos subidos son imágenes o vídeos válidos y publica la entrega como "pending". */
export async function finalizeSubmission(submissionId: string, finalizeToken: string): Promise<FinalizeResult> {
  if (!uuidSchema.safeParse(submissionId).success || typeof finalizeToken !== "string" || finalizeToken.length > 100) {
    return { ok: false, error: "invalidData" };
  }
  if (!(await rateLimit(await clientKey("finalize"), 20, 3600))) {
    return { ok: false, error: "rateLimited" };
  }

  const db = supabaseAdmin();
  const { data: sub } = await db
    .from("submissions")
    .select("id, status, upload_token_hash, created_at, media_count")
    .eq("id", submissionId)
    .maybeSingle();

  const tokenHash = sha256(finalizeToken);
  if (!sub || sub.status !== "uploading" || !sub.upload_token_hash || !safeEqual(sub.upload_token_hash, tokenHash)) {
    return { ok: false, error: "submissionGone" };
  }
  if (Date.now() - new Date(sub.created_at).getTime() > UPLOAD_WINDOW_MS) {
    await discard(submissionId);
    return { ok: false, error: "uploadExpired" };
  }

  const { data: mediaRows } = await db
    .from("submission_media")
    .select("storage_path, content_type")
    .eq("submission_id", submissionId);

  const problem = await validateUploadedFiles(submissionId, mediaRows ?? [], sub.media_count);
  if (problem) {
    await discard(submissionId);
    return { ok: false, error: problem };
  }

  // Transición atómica: solo una petición puede pasar de "uploading" a "pending"
  const { data: updated, error } = await db
    .from("submissions")
    .update({ status: "pending", submitted_at: new Date().toISOString(), upload_token_hash: null })
    .eq("id", submissionId)
    .eq("status", "uploading")
    .eq("upload_token_hash", tokenHash)
    .select("id");

  if (error || !updated || updated.length !== 1) {
    return { ok: false, error: "submissionGone" };
  }
  return { ok: true };
}

async function validateUploadedFiles(
  submissionId: string,
  rows: { storage_path: string; content_type: string }[],
  expected: number,
): Promise<string | null> {
  if (rows.length !== expected) return "uploadIncomplete";
  const storage = supabaseAdmin().storage.from(BUCKET);

  const { data: listed, error } = await storage.list(submissionId, { limit: 20 });
  if (error) return "uploadIncomplete";
  const byName = new Map((listed ?? []).map((o) => [`${submissionId}/${o.name}`, o]));
  if (byName.size !== expected) return "uploadIncomplete";

  for (const row of rows) {
    const obj = byName.get(row.storage_path);
    const size = Number((obj?.metadata as { size?: number } | null)?.size ?? 0);
    const video = isVideoType(row.content_type);
    if (!obj || size <= 0 || size > (video ? MAX_VIDEO_BYTES : MAX_FILE_BYTES)) return "uploadInvalid";

    // Leer solo los primeros bytes para comprobar que de verdad es una imagen o un vídeo
    const { data: signed } = await storage.createSignedUrl(row.storage_path, 60);
    if (!signed?.signedUrl) return "uploadIncomplete";
    const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
    if (!res.ok) return "uploadIncomplete";
    const head = new Uint8Array(await res.arrayBuffer()).slice(0, 16);
    const real = video ? sniffVideoType(head) : sniffImageType(head);
    if (!real || real !== row.content_type) return "uploadInvalid";
  }
  return null;
}

async function discard(submissionId: string) {
  const db = supabaseAdmin();
  const { data } = await db.storage.from(BUCKET).list(submissionId, { limit: 50 });
  await removeObjects((data ?? []).map((o) => `${submissionId}/${o.name}`));
  await db.from("submissions").delete().eq("id", submissionId).eq("status", "uploading");
}
