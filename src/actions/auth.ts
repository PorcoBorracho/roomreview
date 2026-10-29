"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { rateLimit, resetRateLimit } from "@/lib/ratelimit";
import { clientIp, clientKey } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBoardBySlug, getBoardSecrets } from "@/lib/boards";
import { accountPasswordProblem, totpCodeSchema, usernameSchema } from "@/lib/validation";
import { newTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { LEGAL } from "@/config/legal";
import { hasAnyAdmin } from "@/lib/accounts";
import { audit, type AuditActor } from "@/lib/audit";
import {
  addGrant, clearMfa, destroySession, getSession, readMfa, signInAccount, startMfa,
} from "@/lib/session";

/** Los errores son claves del diccionario (sección "errors") */
export type AuthState = { error?: string; step?: "totp"; ok?: boolean };

// Hash de relleno: si el usuario no existe se compara contra esto, para no revelarlo por el tiempo de respuesta
const DUMMY_HASH = "scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const WINDOW = 15 * 60;

/** Destinos permitidos tras el login (evita redirecciones abiertas): solo rutas propias conocidas */
const NEXT_RE = /^\/(?:(?:admins|problems|audit|account)|[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:queue|deck))?)?$/;
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.length <= 200 && NEXT_RE.test(s) ? s : "";
};
const str = (f: FormData, k: string, max = 256) => {
  const v = f.get(k);
  return typeof v === "string" ? v.slice(0, max) : "";
};

type AdminRow = {
  id: string; username: string; password_hash: string; session_version: number;
  must_change_password: boolean; password_expires_at: string | null; totp_secret_enc: string | null;
};
const ADMIN_COLS = "id, username, password_hash, session_version, must_change_password, password_expires_at, totp_secret_enc";

async function captcha(f: FormData): Promise<string | null> {
  const token = str(f, "cf-turnstile-response", 2048);
  if (!token) return "captchaMissing";
  return (await verifyTurnstile(token, await clientIp(), "login")) ? null : "captchaFailed";
}

const accountActor = (row: { id: string; username: string }): AuditActor => ({ type: "account", id: row.id, name: row.username });

async function finishAccountLogin(row: { id: string; username: string; must_change_password: boolean }, sessionVersion: number, next: string, mfa: boolean): Promise<never> {
  await signInAccount(row.id, sessionVersion);
  await audit("account.login", { actor: accountActor(row), details: { mfa, oneTime: row.must_change_password } });
  await supabaseAdmin().from("admins").update({ last_login_at: new Date().toISOString() }).eq("id", row.id);
  redirect(row.must_change_password ? "/account/password" : next || "/");
}

/* ------------------------- Login con cuenta ------------------------- */

export async function accountLogin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  const userParsed = usernameSchema.safeParse(str(formData, "username", 64));
  const password = str(formData, "password");
  const username = userParsed.success ? userParsed.data : "";

  // Anti fuerza bruta: por IP, por cuenta y global. Un login correcto pone a cero los de su IP y su cuenta.
  const ipKey = await clientKey("login");
  const userKey = username ? `login:user:${username}` : null;
  const checks = await Promise.all([
    rateLimit(ipKey, 10, WINDOW),
    rateLimit("login:global", 300, WINDOW),
    userKey ? rateLimit(userKey, 10, WINDOW) : Promise.resolve(true),
  ]);
  if (checks.includes(false)) return { error: "loginRateLimited" };

  const c = await captcha(formData);
  if (c) return { error: c };
  if (!username || !password) return { error: "incorrectPassword" };

  const { data } = await supabaseAdmin().from("admins").select(ADMIN_COLS).eq("username", username).maybeSingle();
  const row = data as AdminRow | null;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    // Solo se registran los fallos de cuentas que existen (lo escrito en "usuario" podría ser cualquier cosa)
    if (row) await audit("account.login_failed", { actor: { type: "visitor" }, target: { id: row.id, name: row.username } });
    return { error: "incorrectPassword" };
  }

  if (row.must_change_password && (!row.password_expires_at || new Date(row.password_expires_at) < new Date())) {
    await audit("account.login_failed", { actor: { type: "visitor" }, target: { id: row.id, name: row.username }, details: { reason: "otpExpired" } });
    return { error: "otpExpired" };
  }
  await Promise.all([resetRateLimit(ipKey), userKey ? resetRateLimit(userKey) : Promise.resolve()]);

  if (row.totp_secret_enc) {
    await startMfa(row.id, row.session_version);
    return { step: "totp" };
  }
  return finishAccountLogin(row, row.session_version, next, false);
}

/** Segundo paso: código de la app de autenticación */
export async function verifyLoginTotp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  const pending = await readMfa();
  if (!pending) return { error: "mfaExpired" };

  const checks = await Promise.all([
    rateLimit(`mfa:user:${pending.id}`, 6, WINDOW),
    rateLimit(await clientKey("mfa"), 12, WINDOW),
  ]);
  if (checks.includes(false)) return { error: "loginRateLimited", step: "totp" };

  const code = totpCodeSchema.safeParse(str(formData, "code", 16));
  if (!code.success) return { error: "totpInvalid", step: "totp" };

  const { data } = await supabaseAdmin().from("admins").select(ADMIN_COLS).eq("id", pending.id).maybeSingle();
  const row = data as AdminRow | null;
  if (!row || row.session_version !== pending.sessionVersion || !row.totp_secret_enc) {
    await clearMfa();
    return { error: "mfaExpired" };
  }
  const secret = decryptSecret(row.totp_secret_enc, "totp-v1");
  const step = secret ? verifyTotp(secret, code.data) : null;
  // Cada código vale una sola vez, aunque lleguen dos peticiones a la vez
  const fresh = step === null ? false : (await supabaseAdmin().rpc("admin_use_totp_step", { p_id: row.id, p_step: step })).data === true;
  if (!fresh) {
    await audit("account.mfa_failed", { actor: { type: "visitor" }, target: { id: row.id, name: row.username } });
    return { error: "totpInvalid", step: "totp" };
  }

  await clearMfa();
  await resetRateLimit(`mfa:user:${row.id}`);
  return finishAccountLogin(row, row.session_version, next, true);
}

/* ---------------- Login con la contraseña de un board ---------------- */

const boardLoginSchema = z.object({
  slug: z.string().max(48),
  target: z.enum(["queue", "deck"]),
});

/**
 * /{board}/queue → contraseña de Board Admin.
 * /{board}/deck  → contraseña de streamer (o la de Board Admin, que también puede ver el deck).
 */
export async function boardLogin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = boardLoginSchema.safeParse({ slug: str(formData, "slug", 64), target: str(formData, "target", 8) });
  if (!parsed.success) return { error: "incorrectBoardPassword" };
  const password = str(formData, "password");
  const board = await getBoardBySlug(parsed.data.slug);

  const ipKey = await clientKey("board-login");
  const boardKey = board ? `login:board:${board.id}` : null;
  const checks = await Promise.all([
    rateLimit(ipKey, 10, WINDOW),
    rateLimit("login:global", 300, WINDOW),
    boardKey ? rateLimit(boardKey, 20, WINDOW) : Promise.resolve(true),
  ]);
  if (checks.includes(false)) return { error: "loginRateLimited" };

  const c = await captcha(formData);
  if (c) return { error: c };

  const secrets = board ? await getBoardSecrets(board.id) : null;
  // Se comprueban siempre las dos para que el tiempo de respuesta no revele cuál coincide (o si existe)
  const [isModerator, isStreamer] = await Promise.all([
    verifyPassword(password, secrets?.moderatorHash ?? DUMMY_HASH),
    verifyPassword(password, secrets?.streamerHash ?? DUMMY_HASH),
  ]);
  if (!board || !secrets) return { error: "incorrectBoardPassword" };

  const target = parsed.data.target;
  const ref = { id: board.id, title: board.title };
  if (isModerator && secrets.moderatorHash) {
    await addGrant(board.id, "moderator", secrets.moderatorVersion);
    await audit("board.login", { actor: { type: "moderator" }, board: ref, details: { kind: "moderator" } });
  } else if (isStreamer && secrets.streamerHash && target === "deck") {
    await addGrant(board.id, "streamer", secrets.streamerVersion);
    await audit("board.login", { actor: { type: "streamer" }, board: ref, details: { kind: "streamer" } });
  } else {
    await audit("board.login_failed", { actor: { type: "visitor" }, board: ref, details: { page: target } });
    return { error: "incorrectBoardPassword" };
  }
  await Promise.all([resetRateLimit(ipKey), boardKey ? resetRateLimit(boardKey) : Promise.resolve()]);
  redirect(`/${board.slug}/${target}`);
}

/* ----------------------- Configuración inicial ----------------------- */

/**
 * Crea el primer Site Admin. Solo funciona mientras no exista ninguna cuenta, y exige la
 * contraseña de configuración (la de ADMIN_PASSWORD_HASH), así que un visitante no puede adelantarse.
 */
export async function setupSiteAdmin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await rateLimit(await clientKey("setup"), 5, WINDOW))) return { error: "loginRateLimited" };
  const c = await captcha(formData);
  if (c) return { error: c };
  if (await hasAnyAdmin()) return { error: "setupDone" };

  const okSetup = await verifyPassword(str(formData, "setupPassword"), serverEnv.adminPasswordHash);
  if (!okSetup) return { error: "incorrectBoardPassword" };

  const user = usernameSchema.safeParse(str(formData, "username", 64));
  if (!user.success) return { error: "usernameInvalid" };
  const password = str(formData, "password");
  if (password !== str(formData, "confirm")) return { error: "passwordsDontMatch" };
  const problem = accountPasswordProblem(password, user.data);
  if (problem) return { error: problem };
  if (await verifyPassword(password, serverEnv.adminPasswordHash)) return { error: "passwordSameAsOld" };

  const { data: id, error } = await supabaseAdmin().rpc("bootstrap_site_admin", { p_username: user.data, p_hash: await hashPassword(password) });
  if (error) return { error: error.hint === "ALREADY_SETUP" ? "setupDone" : "db" };
  await signInAccount(id as string, 1);
  await audit("setup.completed", { actor: { type: "account", id: id as string, name: user.data } });
  redirect("/");
}

/* ------------------------- Cambiar contraseña ------------------------- */

export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const s = await getSession();
  if (!s.account) return { error: "unauthorized" };
  const acc = s.account;
  if (!(await rateLimit(`pw-change:${acc.id}`, 8, WINDOW))) return { error: "rateLimited" };

  const { data } = await supabaseAdmin().from("admins").select(ADMIN_COLS).eq("id", acc.id).maybeSingle();
  const row = data as AdminRow | null;
  if (!row) return { error: "unauthorized" };

  const current = str(formData, "current");
  const password = str(formData, "password");
  if (!(await verifyPassword(current, row.password_hash))) return { error: "currentPasswordWrong" };
  if (password !== str(formData, "confirm")) return { error: "passwordsDontMatch" };
  const problem = accountPasswordProblem(password, row.username);
  if (problem) return { error: problem };
  if (password === current) return { error: "passwordSameAsOld" };

  const { data: sv, error } = await supabaseAdmin().rpc("admin_set_password", {
    p_id: row.id, p_hash: await hashPassword(password), p_must_change: false, p_expires: null, p_clear_totp: false,
  });
  if (error) return { error: "db" };
  // Las demás sesiones quedan cerradas (session_version ha subido); esta se renueva
  await signInAccount(row.id, sv as number);
  await resetRateLimit(`pw-change:${acc.id}`);
  await audit("account.password_changed", { actor: accountActor(row), details: { oneTime: row.must_change_password } });
  if (row.must_change_password) redirect("/");
  return { ok: true };
}

/* --------------------- Verificación en dos pasos --------------------- */

/** Prepara la activación: genera un secreto y su QR. No se guarda nada hasta confirmar con un código. */
export async function startTotpSetup(): Promise<{ ok: true; secret: string; qr: string } | { ok: false; error: string }> {
  const s = await getSession();
  const acc = s.account && !s.account.mustChange ? s.account : null;
  if (!acc) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`totp-setup:${acc.id}`, 20, 3600))) return { ok: false, error: "rateLimited" };
  const secret = newTotpSecret();
  const QR = (await import("qrcode")).default;
  const qr = await QR.toString(otpauthUri(secret, acc.username, LEGAL.projectName), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { ok: true, secret, qr };
}

const B32_SECRET = /^[A-Z2-7]{32}$/;

export async function enableTotp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const s = await getSession();
  const acc = s.account && !s.account.mustChange ? s.account : null;
  if (!acc) return { error: "unauthorized" };
  if (!(await rateLimit(`totp-change:${acc.id}`, 8, WINDOW))) return { error: "rateLimited" };

  const secret = str(formData, "secret", 64);
  const code = totpCodeSchema.safeParse(str(formData, "code", 16));
  if (!B32_SECRET.test(secret)) return { error: "invalidData" };
  const { data } = await supabaseAdmin().from("admins").select(ADMIN_COLS).eq("id", acc.id).maybeSingle();
  const row = data as AdminRow | null;
  if (!row || !(await verifyPassword(str(formData, "password"), row.password_hash))) return { error: "currentPasswordWrong" };
  const step = code.success ? verifyTotp(secret, code.data) : null;
  if (step === null) return { error: "totpInvalid" };

  const { data: sv, error } = await supabaseAdmin().rpc("admin_set_totp", { p_id: row.id, p_enc: encryptSecret(secret, "totp-v1"), p_step: step });
  if (error) return { error: "db" };
  await signInAccount(row.id, sv as number);
  await audit("account.totp_enabled", { actor: accountActor(row) });
  return { ok: true };
}

export async function disableTotp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const s = await getSession();
  const acc = s.account && !s.account.mustChange ? s.account : null;
  if (!acc) return { error: "unauthorized" };
  if (!(await rateLimit(`totp-change:${acc.id}`, 8, WINDOW))) return { error: "rateLimited" };

  const { data } = await supabaseAdmin().from("admins").select(ADMIN_COLS).eq("id", acc.id).maybeSingle();
  const row = data as AdminRow | null;
  if (!row?.totp_secret_enc) return { ok: true };
  if (!(await verifyPassword(str(formData, "password"), row.password_hash))) return { error: "currentPasswordWrong" };
  const code = totpCodeSchema.safeParse(str(formData, "code", 16));
  const secret = decryptSecret(row.totp_secret_enc, "totp-v1");
  const step = code.success && secret ? verifyTotp(secret, code.data) : null;
  if (step === null) return { error: "totpInvalid" };
  const { data: fresh } = await supabaseAdmin().rpc("admin_use_totp_step", { p_id: row.id, p_step: step });
  if (fresh !== true) return { error: "totpInvalid" };

  const { data: sv, error } = await supabaseAdmin().rpc("admin_set_totp", { p_id: row.id, p_enc: null, p_step: null });
  if (error) return { error: "db" };
  await signInAccount(row.id, sv as number);
  await audit("account.totp_disabled", { actor: accountActor(row) });
  return { ok: true };
}

/* ------------------------------ Salir ------------------------------ */

export async function logout() {
  await destroySession();
  redirect("/login");
}
