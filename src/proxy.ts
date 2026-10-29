import { NextResponse, type NextRequest } from "next/server";
import { hkdfSync } from "node:crypto";
import { jwtVerify } from "jose";
import { buildCsp } from "@/lib/csp";

/**
 * Se ejecuta en cada petición de página:
 *  1. Genera un nonce y una CSP estricta para esa petición.
 *  2. Primera barrera de acceso: sin una sesión firmada del tipo adecuado no se llega a las páginas privadas.
 *     Cada página vuelve a comprobar los permisos exactos contra la base de datos.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const need = requirement(pathname);
  if (need && !(await allowed(req, need))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const clean = pathname.replace(/\/$/, "") || "/";
    url.search = clean === "/" ? "" : `?next=${encodeURIComponent(clean)}`;
    const res = NextResponse.redirect(url);
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  // Next.js lee la CSP de la petición y añade el nonce a sus propios scripts
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

type Need = "account" | "moderate" | "view";

function requirement(pathname: string): Need | null {
  if (pathname === "/" || /^\/(admins|problems|account|audit)(\/.*)?$/.test(pathname)) return "account";
  if (/^\/[^/]+\/queue\/?$/.test(pathname)) return "moderate";
  if (/^\/[^/]+\/deck\/?$/.test(pathname)) return "view";
  return null;
}

async function allowed(req: NextRequest, need: Need): Promise<boolean> {
  const name = process.env.NODE_ENV === "production" ? "__Host-rr_session" : "rr_session";
  const token = req.cookies.get(name)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    const key = new Uint8Array(hkdfSync("sha256", secret.trim(), "room-review", "session-v2", 32));
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "session-v2", issuer: "room-review" });
    const hasAccount = !!payload.a;
    const grants = Array.isArray(payload.g) ? (payload.g as { k?: string }[]) : [];
    if (need === "account") return hasAccount;
    if (need === "moderate") return hasAccount || grants.some((g) => g.k === "m");
    return hasAccount || grants.length > 0;
  } catch {
    return false;
  }
}

export const config = {
  // Todas las páginas, excepto ficheros estáticos y API (la API se protege por sí misma)
  matcher: [
    {
      source: "/((?!_next/static|_next/image|api/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|txt)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
    },
  ],
};
