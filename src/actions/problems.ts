"use server";

import { revalidatePath } from "next/cache";
import { firstError, reportSchema, uuidSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, clientKey } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBoardById } from "@/lib/boards";
import { getLocale } from "@/i18n/server";
import { AuthError, requireSiteAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

/** Los errores son claves del diccionario (sección "errors") */
export type ReportState = { ok?: boolean; error?: string };
type Result = { ok: true } | { ok: false; error: string };

const str = (f: FormData, k: string, max: number) => {
  const v = f.get(k);
  return typeof v === "string" ? v.slice(0, max) : "";
};

/** Formulario público "Reportar un problema": cualquiera, sin cuenta, con Turnstile y límites. */
export async function submitReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = reportSchema.safeParse({
    category: str(formData, "category", 20),
    message: str(formData, "message", 4000),
    email: str(formData, "email", 300),
    page: str(formData, "page", 300),
    boardId: str(formData, "board", 48) || undefined,
    turnstileToken: str(formData, "cf-turnstile-response", 2048),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  if (!(await rateLimit(await clientKey("report"), 5, 3600))) return { error: "rateLimited" };
  if (!(await rateLimit("report:global", 200, 3600))) return { error: "serviceBusy" };
  if (!(await verifyTurnstile(parsed.data.turnstileToken, await clientIp(), "report"))) return { error: "captchaFailed" };

  const board = parsed.data.boardId ? await getBoardById(parsed.data.boardId) : null;
  const { error } = await supabaseAdmin().from("problem_reports").insert({
    board_id: board?.id ?? null,
    page: parsed.data.page,
    category: parsed.data.category,
    message: parsed.data.message,
    contact_email: parsed.data.email || null,
    locale: await getLocale(),
  });
  if (error) {
    console.error("report", error.message);
    return { error: "db" };
  }
  revalidatePath("/problems");
  return { ok: true };
}

async function siteAdmin(fn: (actorId: string) => Promise<Result>): Promise<Result> {
  try {
    const acc = await requireSiteAdmin();
    return await fn(acc.id);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "unauthorized" };
    throw e;
  }
}

/** Marcar como resuelto o reabrir. Asignación de un valor: dos clics simultáneos no se contradicen. */
export async function setReportStatus(id: string, status: "open" | "resolved"): Promise<Result> {
  return siteAdmin(async (actorId) => {
    if (!uuidSchema.safeParse(id).success || (status !== "open" && status !== "resolved")) return { ok: false, error: "invalidData" };
    const resolved = status === "resolved";
    const { data, error } = await supabaseAdmin()
      .from("problem_reports")
      .update({ status, resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? actorId : null })
      .eq("id", id)
      .select("id");
    if (error) return { ok: false, error: "db" };
    if (!data?.length) return { ok: false, error: "notFound" };
    await audit(resolved ? "report.resolved" : "report.reopened", { target: { id } });
    revalidatePath("/problems");
    return { ok: true };
  });
}

export async function deleteReport(id: string): Promise<Result> {
  return siteAdmin(async () => {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "invalidData" };
    const { data, error } = await supabaseAdmin().from("problem_reports").delete().eq("id", id).select("id");
    if (error) return { ok: false, error: "db" };
    if (data?.length) await audit("report.deleted", { target: { id } });
    revalidatePath("/problems");
    return { ok: true };
  });
}
