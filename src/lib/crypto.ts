import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Hash con clave para no guardar IPs en claro. */
export function hmac(input: string): string {
  return createHmac("sha256", serverEnv.sessionSecret).update(input).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function scryptAsync(pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Verifica una contraseña contra un hash "scrypt:N:r:p:salt:key" en tiempo constante. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (!Number.isInteger(N) || N < 2 ** 14 || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  const key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N, r, p, maxmem: 128 * N * r * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLen: 64 };

/** Hash "scrypt:N:r:p:salt:key" (mismo formato que scripts/hash-password.mjs). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keyLen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

/**
 * Cifrado reversible para las contraseñas de board (solo para poder copiarlas desde el panel).
 * Clave derivada de SESSION_SECRET con HKDF: si cambias SESSION_SECRET, las contraseñas
 * siguen funcionando para entrar (se comprueban con el hash), pero ya no se podrán copiar.
 */
function boardKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", serverEnv.sessionSecret, "room-review", "board-password-v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", boardKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const d = createDecipheriv("aes-256-gcm", boardKey(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
