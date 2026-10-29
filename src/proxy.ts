import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { buildCsp } from "@/lib/csp";

/**
 * Se ejecuta en cada petición de página:
 *  1. Genera un nonce y una CSP estricta para esa petición.
 *  2. Primera barrera de acceso: sin sesión válida no se llega al panel, a las colas ni a los decks.
 *     (Cada página vuelve a comprobar el rol y, en el deck, que el streamer tenga acceso a ESE board.)
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const isProtected = pathname === "/" || /^\/[^/]+\/(queue|deck)\/?$/.test(pathname);
  if (isProtected && !(await allowed(req, pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname.replace(/\/$/, ""))}`;
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

async function allowed(req: NextRequest, pathname: string): Promise<boolean> {
  const adminOnly = pathname === "/" || /\/queue\/?$/.test(pathname);
  const name = process.env.NODE_ENV === "production" ? "__Host-rr_session" : "rr_session";
  const token = req.cookies.get(name)?.value;
  if (!token || !process.env.SESSION_SECRET) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), {
      algorithms: ["HS256"],
      audience: "room-review",
      issuer: "room-review",
    });
    return adminOnly ? payload.role === "admin" : payload.role === "admin" || payload.role === "streamer";
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
