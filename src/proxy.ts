import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Primera barrera: sin sesión válida no se llega al panel, a las colas ni a los decks.
// Cada página vuelve a comprobar el rol y, en el deck, que el streamer tenga acceso a ESE board.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const adminOnly = pathname === "/" || pathname.endsWith("/queue");
  const name = process.env.NODE_ENV === "production" ? "__Host-rr_session" : "rr_session";
  const token = req.cookies.get(name)?.value;

  let role: unknown = null;
  if (token && process.env.SESSION_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), {
        algorithms: ["HS256"],
        audience: "room-review",
        issuer: "room-review",
      });
      role = payload.role;
    } catch {
      role = null;
    }
  }

  const allowed = adminOnly ? role === "admin" : role === "admin" || role === "streamer";
  if (!allowed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// "/" es el panel de control; "/:slug" (envío público) queda fuera a propósito
export const config = { matcher: ["/", "/:slug/queue", "/:slug/deck"] };
