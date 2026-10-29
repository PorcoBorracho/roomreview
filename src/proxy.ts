import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Primera barrera: sin sesión válida no se llega a /admin ni /streamer.
// (Cada página y cada acción vuelve a comprobar el rol en el servidor.)
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needed = pathname.startsWith("/admin") ? "admin" : "viewer";
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

  const allowed = needed === "admin" ? role === "admin" : role === "admin" || role === "viewer";
  if (!allowed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?role=${needed}&next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/streamer/:path*"] };
