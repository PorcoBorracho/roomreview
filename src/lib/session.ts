import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { hkdfSync } from "node:crypto";
import { serverEnv } from "./env";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Una cookie firmada puede llevar a la vez:
 *  · una cuenta (Owner, Site Admin, Admin o Streamer), identificada por su id y su "session_version";
 *  · permisos de board conseguidos con la contraseña de ese board:
 *      moderator (Board Admin) → cola + deck de ese board
 *      streamer               → deck de ese board
 *    Cada permiso lleva la versión de la contraseña con la que se obtuvo: al regenerarla, deja de valer.
 *
 * En cada petición se vuelve a leer la cuenta de la base de datos (rol actual, si la han borrado,
 * si ha cambiado la contraseña…), así que la cookie nunca da más permisos de los que hay ahora.
 */
export type AdminRole = "owner" | "site_admin" | "admin" | "streamer";
export type GrantKind = "moderator" | "streamer";

export type Account = {
  id: string;
  /** Nombre de usuario; en los streamers, su login de Twitch */
  username: string;
  /** Nombre que se muestra (el de Twitch en los streamers) */
  displayName: string;
  role: AdminRole;
  /** Entró con una contraseña de un solo uso: solo puede ir a /account/password */
  mustChange: boolean;
  totpEnabled: boolean;
  /** Owner sin verificación en dos pasos: solo puede ir a /account/2fa hasta activarla */
  mustEnrollTotp: boolean;
};

/** Owner y Site Admins: lo ven y gestionan todo */
export const isSiteAdmin = (a: { role: AdminRole } | null | undefined) => a?.role === "owner" || a?.role === "site_admin";
export type Grant = { boardId: string; kind: GrantKind };
export type Session = { account: Account | null; grants: Grant[] };

type RawGrant = { b: string; k: "m" | "s"; v: number };
type Claims = { a?: { u: string; v: number }; g?: RawGrant[] };

const SESSION_COOKIE = "__Host-rr_session";
const DEV_COOKIE = "rr_session";
const MFA_COOKIE = "__Host-rr_mfa";
const DEV_MFA_COOKIE = "rr_mfa";
const TWITCH_COOKIE = "__Host-rr_twitch";
const DEV_TWITCH_COOKIE = "rr_twitch";
const SESSION_HOURS = 12;
const MAX_GRANTS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const prod = () => process.env.NODE_ENV === "production";
// __Host- exige HTTPS; en localhost (http) usamos un nombre normal
export const sessionCookieName = () => (prod() ? SESSION_COOKIE : DEV_COOKIE);
const mfaCookieName = () => (prod() ? MFA_COOKIE : DEV_MFA_COOKIE);
const twitchCookieName = () => (prod() ? TWITCH_COOKIE : DEV_TWITCH_COOKIE);

const cookieOptions = () => ({ httpOnly: true, secure: prod(), sameSite: "strict" as const, path: "/" });

/** Clave de firma derivada (HKDF) para no usar SESSION_SECRET directamente en varios sitios */
type Purpose = "session-v2" | "mfa-v1" | "twitch-v1";

function key(purpose: Purpose) {
  return new Uint8Array(hkdfSync("sha256", serverEnv.sessionSecret, "room-review", purpose, 32));
}

async function sign(claims: object, purpose: Purpose, expires: string) {
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .setAudience(purpose)
    .setIssuer("room-review")
    .sign(key(purpose));
}

async function verify(token: string, purpose: Purpose) {
  const { payload } = await jwtVerify(token, key(purpose), { algorithms: ["HS256"], audience: purpose, issuer: "room-review" });
  return payload;
}

/** Claims tal cual vienen en la cookie (firmados), sin comprobar contra la base de datos */
async function readClaims(): Promise<Claims> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return {};
  try {
    const p = await verify(token, "session-v2");
    const out: Claims = {};
    const a = p.a as Claims["a"];
    if (a && typeof a.u === "string" && UUID_RE.test(a.u) && Number.isInteger(a.v)) out.a = { u: a.u, v: a.v };
    if (Array.isArray(p.g)) {
      out.g = (p.g as RawGrant[])
        .filter((g) => g && typeof g.b === "string" && UUID_RE.test(g.b) && (g.k === "m" || g.k === "s") && Number.isInteger(g.v))
        .slice(-MAX_GRANTS);
    }
    return out;
  } catch {
    return {};
  }
}

async function writeClaims(claims: Claims) {
  const jar = await cookies();
  if (!claims.a && !claims.g?.length) {
    jar.set(sessionCookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
    return;
  }
  const token = await sign(claims, "session-v2", `${SESSION_HOURS}h`);
  jar.set(sessionCookieName(), token, { ...cookieOptions(), maxAge: SESSION_HOURS * 3600 });
}

/** Inicia sesión con una cuenta. Conserva los permisos de board que ya tuviera el navegador. */
export async function signInAccount(id: string, sessionVersion: number) {
  const c = await readClaims();
  await writeClaims({ a: { u: id, v: sessionVersion }, g: c.g });
}

/** Añade (o renueva) el permiso de un board. */
export async function addGrant(boardId: string, kind: GrantKind, version: number) {
  const c = await readClaims();
  const k = kind === "moderator" ? "m" : "s";
  const g = (c.g ?? []).filter((x) => !(x.b === boardId && x.k === k));
  g.push({ b: boardId, k, v: version });
  await writeClaims({ a: c.a, g: g.slice(-MAX_GRANTS) });
}

export async function destroySession() {
  // Las cookies __Host- solo se pueden sobrescribir con los mismos atributos (Secure, Path=/)
  const jar = await cookies();
  jar.set(sessionCookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
  jar.set(mfaCookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
}

/* --------------------- Segundo paso del login (2FA) --------------------- */

/** Tras una contraseña correcta con 2FA activo: cookie de 5 minutos que solo sirve para el código. */
export async function startMfa(id: string, sessionVersion: number) {
  const token = await sign({ u: id, v: sessionVersion }, "mfa-v1", "5m");
  (await cookies()).set(mfaCookieName(), token, { ...cookieOptions(), maxAge: 300 });
}

export async function readMfa(): Promise<{ id: string; sessionVersion: number } | null> {
  const token = (await cookies()).get(mfaCookieName())?.value;
  if (!token) return null;
  try {
    const p = await verify(token, "mfa-v1");
    if (typeof p.u !== "string" || !UUID_RE.test(p.u) || !Number.isInteger(p.v)) return null;
    return { id: p.u, sessionVersion: p.v as number };
  } catch {
    return null;
  }
}

export async function clearMfa() {
  (await cookies()).set(mfaCookieName(), "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
}

/* ------------------- Entrada con Twitch (OAuth, parámetro state) ------------------- */

/**
 * Antes de ir a Twitch: un valor aleatorio ("state") firmado en una cookie de 10 minutos.
 * Al volver, Twitch lo devuelve y tiene que coincidir: así nadie puede colar una vuelta que no empezó aquí (CSRF).
 * SameSite=Lax (no Strict): la vuelta desde Twitch es una navegación desde otro sitio y la cookie tiene que llegar.
 */
export async function startTwitchState(state: string, next: string) {
  const token = await sign({ s: state, n: next }, "twitch-v1", "10m");
  (await cookies()).set(twitchCookieName(), token, { ...cookieOptions(), sameSite: "lax", maxAge: 600 });
}

export async function takeTwitchState(): Promise<{ state: string; next: string } | null> {
  const jar = await cookies();
  const token = jar.get(twitchCookieName())?.value;
  // Un solo uso: se borra en cuanto se lee
  jar.set(twitchCookieName(), "", { ...cookieOptions(), sameSite: "lax", maxAge: 0, expires: new Date(0) });
  if (!token) return null;
  try {
    const p = await verify(token, "twitch-v1");
    if (typeof p.s !== "string" || typeof p.n !== "string") return null;
    return { state: p.s, next: p.n };
  } catch {
    return null;
  }
}

/* ------------------------------ Lectura ------------------------------ */

/** Sesión de la petición, comprobada contra la base de datos (una vez por petición). */
export const getSession = cache(async (): Promise<Session> => {
  const c = await readClaims();
  const db = supabaseAdmin();

  const [acc, boards] = await Promise.all([
    c.a
      ? db
          .from("admins")
          .select("id, username, display_name, role, status, session_version, must_change_password, password_expires_at, totp_enabled_at")
          .eq("id", c.a.u)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    c.g?.length
      ? db
          .from("boards")
          .select("id, streamer_pw_version, moderator_pw_version, s:streamer_password_hash, m:moderator_password_hash")
          .in("id", [...new Set(c.g.map((g) => g.b))])
      : Promise.resolve({ data: [] }),
  ]);

  let account: Account | null = null;
  const row = acc.data as
    | {
        id: string; username: string; display_name: string | null; role: AdminRole; status: string; session_version: number;
        must_change_password: boolean; password_expires_at: string | null; totp_enabled_at: string | null;
      }
    | null;
  // Un streamer pendiente o suspendido no tiene sesión
  if (row && c.a && row.session_version === c.a.v && row.status === "active") {
    const expired = row.must_change_password && (!row.password_expires_at || new Date(row.password_expires_at) < new Date());
    if (!expired) {
      account = {
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        role: row.role,
        mustChange: row.must_change_password,
        totpEnabled: !!row.totp_enabled_at,
        mustEnrollTotp: row.role === "owner" && !row.totp_enabled_at,
      };
    }
  }

  const byId = new Map(
    ((boards.data ?? []) as { id: string; streamer_pw_version: number; moderator_pw_version: number; s: string | null; m: string | null }[]).map((b) => [b.id, b]),
  );
  const grants: Grant[] = [];
  for (const g of c.g ?? []) {
    const b = byId.get(g.b);
    if (!b) continue;
    if (g.k === "m" && b.m && b.moderator_pw_version === g.v) grants.push({ boardId: g.b, kind: "moderator" });
    if (g.k === "s" && b.s && b.streamer_pw_version === g.v) grants.push({ boardId: g.b, kind: "streamer" });
  }
  return { account, grants };
});

/** Cuenta utilizable: excluye la que aún tiene que cambiar la contraseña de un solo uso o activar el 2FA obligatorio */
export const activeAccount = (s: Session) => (s.account && !s.account.mustChange && !s.account.mustEnrollTotp ? s.account : null);

export type BoardAccess = {
  /** Ver el deck */
  view: boolean;
  /** Cola: aprobar, devolver y borrar entregas */
  moderate: boolean;
  /** Editar el board, ver y regenerar sus contraseñas */
  manage: boolean;
  /** Borrar el board: quien lo creó, su streamer o un Site Admin */
  own: boolean;
  /** Compartirlo con otros admins: quien lo creó o un Site Admin */
  share: boolean;
};

const NO_ACCESS: BoardAccess = { view: false, moderate: false, manage: false, own: false, share: false };

/**
 * Qué puede hacer esta sesión con este board:
 *  · Owner / Site Admin: todo.
 *  · Admin: los boards que creó, los compartidos con él y los de los streamers de cuyo equipo forma parte.
 *  · Streamer: sus boards (editar, ver el deck y borrarlos), pero NO la cola.
 *  · Contraseñas del board: Board Admin → cola y deck; streamer → deck.
 */
export const boardAccess = cache(async (boardId: string): Promise<BoardAccess> => {
  if (!UUID_RE.test(boardId)) return NO_ACCESS;
  const s = await getSession();
  const acc = activeAccount(s);
  let a = { ...NO_ACCESS };
  if (isSiteAdmin(acc)) {
    a = { view: true, moderate: true, manage: true, own: true, share: true };
  } else if (acc) {
    const db = supabaseAdmin();
    const { data: b } = await db.from("boards").select("owner_id, streamer_id").eq("id", boardId).maybeSingle();
    if (b && acc.role === "streamer") {
      const mine = b.streamer_id === acc.id;
      a = { view: mine, moderate: false, manage: mine, own: mine, share: false };
    } else if (b && acc.role === "admin") {
      const [{ data: m }, { data: team }] = await Promise.all([
        db.from("board_members").select("admin_id").eq("board_id", boardId).eq("admin_id", acc.id).maybeSingle(),
        b.streamer_id
          ? db.from("streamer_admins").select("admin_id").eq("streamer_id", b.streamer_id).eq("admin_id", acc.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const own = b.owner_id === acc.id;
      const manage = own || !!m || !!team;
      a = { view: manage, moderate: manage, manage, own, share: own };
    }
  }
  if (s.grants.some((g) => g.boardId === boardId && g.kind === "moderator")) a.moderate = a.view = true;
  if (s.grants.some((g) => g.boardId === boardId && g.kind === "streamer")) a.view = true;
  return a;
});

/** Rol que se muestra en la cabecera para un board (o el de la cuenta fuera de los boards) */
export async function displayRole(boardId?: string): Promise<AdminRole | "moderator" | "deck" | null> {
  const s = await getSession();
  const acc = activeAccount(s);
  if (acc) return acc.role;
  if (!boardId) return null;
  const a = await boardAccess(boardId);
  if (a.moderate) return "moderator";
  if (a.view) return "deck";
  return null;
}

/* ------------------------------ Guardas ------------------------------ */

/** Adonde se va tras entrar si no se pidió otra página */
export const HOME_PANEL = "/panel";

export function loginUrl(nextPath: string) {
  return nextPath === HOME_PANEL ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;
}

/** Pasos obligatorios antes de usar el panel: contraseña de un solo uso → elegir una; Owner sin 2FA → activarlo */
function pendingStep(acc: Account) {
  if (acc.mustChange) redirect("/account/password");
  if (acc.mustEnrollTotp) redirect("/account/2fa");
}

/** Páginas que necesitan cuenta. */
export async function requireAccountPage(nextPath: string): Promise<Account> {
  const s = await getSession();
  if (!s.account) redirect(loginUrl(nextPath));
  pendingStep(s.account);
  return s.account;
}

/** Páginas solo para el Owner y los Site Admins: al resto les parece que no existen. */
export async function requireSiteAdminPage(nextPath: string): Promise<Account> {
  const acc = await requireAccountPage(nextPath);
  if (!isSiteAdmin(acc)) notFound();
  return acc;
}

/** Páginas solo para streamers */
export async function requireStreamerPage(nextPath: string): Promise<Account> {
  const acc = await requireAccountPage(nextPath);
  if (acc.role !== "streamer") notFound();
  return acc;
}

/** Cola (moderate) o deck (view) de un board. */
export async function requireBoardPage(boardId: string, need: "view" | "moderate", nextPath: string) {
  const access = await boardAccess(boardId);
  if (!access[need]) {
    const s = await getSession();
    if (s.account) pendingStep(s.account);
    // Al login del board: allí se puede usar la contraseña de ese board aunque se tenga otra cuenta
    redirect(loginUrl(nextPath));
  }
  return access;
}

export class AuthError extends Error {
  constructor() {
    super("UNAUTHORIZED");
  }
}

export async function requireAccount(): Promise<Account> {
  const acc = activeAccount(await getSession());
  if (!acc) throw new AuthError();
  return acc;
}

export async function requireSiteAdmin(): Promise<Account> {
  const acc = await requireAccount();
  if (!isSiteAdmin(acc)) throw new AuthError();
  return acc;
}

export async function requireStreamer(): Promise<Account> {
  const acc = await requireAccount();
  if (acc.role !== "streamer") throw new AuthError();
  return acc;
}

export async function requireBoard(boardId: string, need: keyof BoardAccess): Promise<BoardAccess> {
  const a = await boardAccess(boardId);
  if (!a[need]) throw new AuthError();
  return a;
}
