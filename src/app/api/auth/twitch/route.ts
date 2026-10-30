import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { startTwitchState } from "@/lib/session";
import { authorizeUrl, twitchConfig } from "@/lib/twitch";

export const dynamic = "force-dynamic";

/** Destinos permitidos tras entrar (sin redirecciones abiertas) */
const NEXT_RE = /^\/(?:panel|team|account|[a-z0-9_]{1,40}\/[a-z0-9]+(?:-[a-z0-9]+)*\/deck)$/;

/** Empieza la entrada con Twitch: guarda un "state" firmado y manda al visitante a Twitch. */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/login?twitch=${q}`, req.nextUrl.origin), 303);
  const cfg = twitchConfig();
  if (!cfg) return back("off");
  if (!(await rateLimit(await clientKey("twitch-start"), 20, 900))) return back("busy");

  const raw = req.nextUrl.searchParams.get("next") ?? "";
  const next = raw.length <= 120 && NEXT_RE.test(raw) ? raw : "";
  const state = randomToken(24);
  await startTwitchState(state, next);
  const redirectUri = `${req.nextUrl.origin}/api/auth/twitch/callback`;
  return NextResponse.redirect(authorizeUrl(cfg.clientId, redirectUri, state), 303);
}
