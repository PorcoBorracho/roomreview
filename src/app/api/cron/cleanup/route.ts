import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverEnv } from "@/lib/env";
import { AUDIT_DAYS, BUCKET, PENDING_STREAMER_DAYS, REPORT_MAX_DAYS, REPORT_RESOLVED_DAYS } from "@/lib/limits";
import { safeEqual } from "@/lib/crypto";
import { removeObjects } from "@/lib/media";
import { LEGAL } from "@/config/legal";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Limpieza diaria (vercel.json): entregas abandonadas a medias y contadores viejos.
export async function GET(req: Request) {
  const secret = serverEnv.cronSecret;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // subidas incompletas
  const { data: stale } = await db
    .from("submissions")
    .select("id")
    .eq("status", "uploading")
    .lt("created_at", cutoff)
    .limit(200);

  let removed = 0;
  for (const s of stale ?? []) {
    const { data: files } = await db.storage.from(BUCKET).list(s.id, { limit: 50 });
    await removeObjects((files ?? []).map((f) => `${s.id}/${f.name}`));
    await db.from("submissions").delete().eq("id", s.id).eq("status", "uploading");
    removed++;
  }

  // Plazo de conservación (RGPD art. 5.1.e): borrar entregas antiguas, aprobadas o no
  const retentionCutoff = new Date(Date.now() - LEGAL.retentionDays * 24 * 3600 * 1000).toISOString();
  const { data: expired } = await db
    .from("submissions")
    .select("id")
    .in("status", ["pending", "approved"])
    .lt("created_at", retentionCutoff)
    .limit(500);
  let expiredCount = 0;
  for (const s of expired ?? []) {
    const { data: files } = await db.storage.from(BUCKET).list(s.id, { limit: 50 });
    await removeObjects((files ?? []).map((f) => `${s.id}/${f.name}`));
    await db.from("submissions").delete().eq("id", s.id);
    expiredCount++;
  }

  // Problemas reportados: se borran 30 días después de resolverlos, y como mucho al año
  const day = 24 * 3600 * 1000;
  const { data: r1 } = await db.from("problem_reports").delete().eq("status", "resolved")
    .lt("resolved_at", new Date(Date.now() - REPORT_RESOLVED_DAYS * day).toISOString()).select("id");
  const { data: r2 } = await db.from("problem_reports").delete()
    .lt("created_at", new Date(Date.now() - REPORT_MAX_DAYS * day).toISOString()).select("id");
  const reports = (r1?.length ?? 0) + (r2?.length ?? 0);

  // Registro de auditoría: se conserva 365 días (la base de datos impide borrar antes)
  const { data: a } = await db.from("audit_log").delete().lt("created_at", new Date(Date.now() - AUDIT_DAYS * day).toISOString()).select("id");

  // Solicitudes de streamer que nadie ha aprobado en PENDING_STREAMER_DAYS días
  const { data: st } = await db.from("admins").delete().eq("role", "streamer").eq("status", "pending")
    .lt("created_at", new Date(Date.now() - PENDING_STREAMER_DAYS * day).toISOString()).select("id");
  const pendingStreamers = st?.length ?? 0;

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await db.from("rate_limits").delete().lt("window_start", dayAgo);

  if (removed || expiredCount || reports || a?.length || pendingStreamers) {
    await audit("system.cleanup", {
      actor: { type: "system" },
      details: { incomplete: removed, expired: expiredCount, reports, auditEntries: a?.length ?? 0, pendingStreamers },
    });
  }
  return NextResponse.json({ ok: true, removed, expired: expiredCount, reports, pendingStreamers });
}
