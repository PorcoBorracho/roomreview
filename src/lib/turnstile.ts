import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "./env";

export const TURNSTILE_ACTION = "submit";

// Claves de prueba oficiales de Cloudflare: devuelven un hostname ficticio, así que no se comprueba
const TEST_SECRET = /^[123]x0{30,}/;

type SiteVerify = { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };

/**
 * Verifica el token en Cloudflare y además (recomendación de Cloudflare):
 *  · que se emitió para ESTE dominio (un token conseguido en otra web no sirve)
 *  · que se emitió para la acción de envío
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const secret = serverEnv.turnstileSecret;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as SiteVerify;
    if (data.success !== true) return false;
    if (TEST_SECRET.test(secret)) return true;

    const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
    if (!data.hostname || data.hostname.toLowerCase() !== host) {
      console.warn("turnstile hostname mismatch", data.hostname, host);
      return false;
    }
    if (data.action && data.action !== TURNSTILE_ACTION) return false;
    return true;
  } catch (e) {
    console.error("turnstile error", e);
    return false;
  }
}
