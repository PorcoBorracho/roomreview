import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serverEnv, BUCKET } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { removeObjects } from "@/lib/media";

export const dynamic = "force-dynamic";

// Limpieza diaria (vercel.json): entregas abandonadas a medias y contadores viejos.
export async function GET(req: Request) {
  const secret = serverEnv.cronSecret;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
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

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await db.from("rate_limits").delete().lt("window_start", dayAgo);

  return NextResponse.json({ ok: true, removed });
}
