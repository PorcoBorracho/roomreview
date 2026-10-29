import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "./env";
import { sha256 } from "./crypto";

export type Role = "admin" | "viewer";
export const SESSION_COOKIE = "__Host-rr_session";
const DEV_COOKIE = "rr_session";
const SESSION_HOURS = 12;

function cookieName() {
  // __Host- exige HTTPS; en localhost (http) usamos un nombre normal
  return process.env.NODE_ENV === "production" ? SESSION_COOKIE : DEV_COOKIE;
}

function key() {
  return new TextEncoder().encode(serverEnv.sessionSecret);
}

/** Huella del hash de contraseña: si cambias la contraseña, las sesiones antiguas dejan de valer. */
function passwordVersion(role: Role) {
  const h = role === "admin" ? serverEnv.adminPasswordHash : serverEnv.viewerPasswordHash;
  return sha256(h).slice(0, 16);
}

export async function createSession(role: Role) {
  const token = await new SignJWT({ role, pv: passwordVersion(role) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setAudience("room-review")
    .setIssuer("room-review")
    .sign(key());

  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  // Las cookies __Host- solo se pueden sobrescribir con los mismos atributos (Secure, Path=/)
  (await cookies()).set(cookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSession(): Promise<{ role: Role } | null> {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: "room-review",
      issuer: "room-review",
    });
    const role = payload.role;
    if (role !== "admin" && role !== "viewer") return null;
    if (payload.pv !== passwordVersion(role)) return null;
    return { role };
  } catch {
    return null;
  }
}

/** admin puede todo; viewer solo visualizar. */
export function hasAccess(role: Role, needed: Role) {
  return needed === "viewer" ? role === "viewer" || role === "admin" : role === "admin";
}

/** Para páginas: redirige al login si no hay permiso. */
export async function requirePageRole(needed: Role, nextPath: string) {
  const s = await getSession();
  if (!s || !hasAccess(s.role, needed)) {
    redirect(`/login?role=${needed}&next=${encodeURIComponent(nextPath)}`);
  }
  return s;
}

/** Para server actions / API: lanza error si no hay permiso. */
export async function requireRole(needed: Role) {
  const s = await getSession();
  if (!s || !hasAccess(s.role, needed)) throw new Error("UNAUTHORIZED");
  return s;
}
