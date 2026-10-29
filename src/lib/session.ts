import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "./env";
import { sha256 } from "./crypto";

/**
 * admin: todo el panel.
 * streamer: solo el deck (y la página pública) de los boards cuya contraseña ha introducido.
 */
export type Session = { role: "admin" } | { role: "streamer"; boards: string[] };
export type Role = Session["role"];

export const SESSION_COOKIE = "__Host-rr_session";
const DEV_COOKIE = "rr_session";
const SESSION_HOURS = 12;
const MAX_BOARDS = 20;

function cookieName() {
  // __Host- exige HTTPS; en localhost (http) usamos un nombre normal
  return process.env.NODE_ENV === "production" ? SESSION_COOKIE : DEV_COOKIE;
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
});

function key() {
  return new TextEncoder().encode(serverEnv.sessionSecret);
}

/** Huella del hash de admin: si cambias la contraseña de admin, sus sesiones dejan de valer. */
function adminVersion() {
  return sha256(serverEnv.adminPasswordHash).slice(0, 16);
}

export async function createSession(session: Session) {
  const claims =
    session.role === "admin"
      ? { role: "admin", pv: adminVersion() }
      : { role: "streamer", boards: [...new Set(session.boards)].slice(-MAX_BOARDS) };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setAudience("room-review")
    .setIssuer("room-review")
    .sign(key());

  (await cookies()).set(cookieName(), token, { ...cookieOptions(), maxAge: SESSION_HOURS * 3600 });
}

export async function destroySession() {
  // Las cookies __Host- solo se pueden sobrescribir con los mismos atributos (Secure, Path=/)
  (await cookies()).set(cookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: "room-review",
      issuer: "room-review",
    });
    if (payload.role === "admin") return payload.pv === adminVersion() ? { role: "admin" } : null;
    if (payload.role === "streamer" && Array.isArray(payload.boards)) {
      const boards = payload.boards.filter((b): b is string => typeof b === "string").slice(0, MAX_BOARDS);
      return { role: "streamer", boards };
    }
    return null;
  } catch {
    return null;
  }
}

export const isAdmin = (s: Session | null): s is { role: "admin" } => s?.role === "admin";

/** ¿Puede esta sesión ver el deck de este board? */
export function canViewBoard(s: Session | null, boardId: string): boolean {
  if (!s) return false;
  return s.role === "admin" || s.boards.includes(boardId);
}

function loginUrl(nextPath: string) {
  return nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;
}

/** Para páginas de admin: redirige al login si no hay permiso. */
export async function requireAdminPage(nextPath: string) {
  const s = await getSession();
  if (!isAdmin(s)) redirect(loginUrl(nextPath));
  return s;
}

/** Para el deck: admin o streamer con acceso a ese board. */
export async function requireBoardPage(boardId: string, nextPath: string) {
  const s = await getSession();
  if (!canViewBoard(s, boardId)) redirect(loginUrl(nextPath));
  return s as Session;
}

/** Para server actions / API: lanza error si no es admin. */
export async function requireAdmin() {
  const s = await getSession();
  if (!isAdmin(s)) throw new Error("UNAUTHORIZED");
  return s;
}
