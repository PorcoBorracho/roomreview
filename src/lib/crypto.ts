import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
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
