import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { HOME_PANEL, signInAccount, takeTwitchState } from "@/lib/session";
import { fetchTwitchUser } from "@/lib/twitch";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isReservedPath } from "@/lib/slug";
import { MAX_PENDING_STREAMERS } from "@/lib/limits";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Tras iniciar sesión no se redirige con un 303: la vuelta viene de twitch.tv (otro sitio) y, en una cadena de
 * redirecciones que empezó en otro sitio, el navegador no envía la cookie de sesión (SameSite=Strict).
 * Una página mínima que navega desde nuestro propio dominio hace que la siguiente petición ya la lleve.
 */
function continueTo(path: string) {
  const safe = path.replace(/[^A-Za-z0-9/_\-]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${safe}"><title>…</title></head><body><a href="${safe}">Continue</a></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * Vuelta desde Twitch. Comprueba el state, lee la identidad y:
 *  · cuenta nueva → solicitud pendiente de aprobación (sin sesión);
 *  · aprobada     → inicia sesión;
 *  · pendiente o suspendida → se le explica, sin sesión.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/login?twitch=${q}`, origin), 303);
  const saved = await takeTwitchState();
  const sp = req.nextUrl.searchParams;

  if (!(await rateLimit(await clientKey("twitch-callback"), 30, 900))) return back("busy");
  const state = sp.get("state") ?? "";
  if (!saved || !state || state.length > 100 || !safeEqual(state, saved.state)) return back("error");
  if (sp.get("error")) return back("denied"); // canceló en Twitch
  const code = sp.get("code") ?? "";
  if (!code || code.length > 200) return back("error");

  const user = await fetchTwitchUser(code, `${origin}/api/auth/twitch/callback`).catch((e) => {
    console.error("twitch", e);
    return null;
  });
  if (!user) return back("error");
  // Su página sería /{login}: no puede coincidir con una página de la web
  if (isReservedPath(user.login)) return back("reserved");

  const { data, error } = await supabaseAdmin().rpc("streamer_sign_in", {
    p_twitch_id: user.id,
    p_login: user.login,
    p_display: user.displayName,
    p_avatar: user.avatarUrl,
    p_max_pending: MAX_PENDING_STREAMERS,
  });
  if (error) {
    if (error.hint === "PENDING_FULL") return back("full");
    console.error("streamer_sign_in", error.message);
    return back("error");
  }
  const row = (data as { o_id: string; o_status: string; o_session_version: number; o_new: boolean }[] | null)?.[0];
  if (!row) return back("error");
  const actor = { type: "account" as const, id: row.o_id, name: user.login };

  if (row.o_status === "pending") {
    if (row.o_new) await audit("streamer.requested", { actor, details: { isNew: true } });
    return back("pending");
  }
  if (row.o_status !== "active") return back("suspended");

  await signInAccount(row.o_id, row.o_session_version);
  await audit("streamer.login", { actor });
  return continueTo(saved.next || HOME_PANEL);
}
