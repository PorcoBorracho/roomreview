import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "./env";

/** Cada formulario usa su propia acción: un token del formulario de login no sirve para enviar fotos */
export type TurnstileAction = "submit" | "login" | "report";

// Claves de prueba oficiales de Cloudflare: devuelven un hostname ficticio, así que no se comprueba
const TEST_SECRET = /^[123]x0{30,}/;

type SiteVerify = { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };

/**
 * Verifica el token en Cloudflare y además (recomendación de Cloudflare):
 *  · que se emitió para ESTE dominio (un token conseguido en otra web no sirve)
 *  · que se emitió para la acción de ESTE formulario
 */
export async function verifyTurnstile(token: string, ip: string, action: TurnstileAction): Promise<boolean> {
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
    if (data.success !== true) {
      // El motivo solo va a los logs del servidor (Vercel → Logs), nunca al visitante
      const codes = data["error-codes"] ?? [];
      const hint = token.includes("DUMMY")
        ? "the site key is a TEST key but TURNSTILE_SECRET_KEY is a real one: use both test keys or both real keys from the same widget"
        : codes.includes("invalid-input-secret")
          ? "TURNSTILE_SECRET_KEY is wrong or belongs to another widget"
          : codes.includes("timeout-or-duplicate")
            ? "token expired or already used"
            : "";
      console.warn(`turnstile rejected (${action}): ${codes.join(", ") || "no error code"}${hint ? ` -> ${hint}` : ""}`);
      return false;
    }
    if (TEST_SECRET.test(secret)) return true;

    // Detrás de un proxy propio (Docker, Cloudflare Tunnel…) "host" puede ser interno: se prefiere x-forwarded-host
    const h = await headers();
    const host = (h.get("x-forwarded-host")?.split(",")[0] ?? h.get("host") ?? "").trim().split(":")[0].toLowerCase();
    if (!data.hostname || data.hostname.toLowerCase() !== host) {
      console.warn(`turnstile hostname mismatch (${action}): token for "${data.hostname}", request for "${host}"`);
      return false;
    }
    if (data.action !== action) {
      console.warn(`turnstile action mismatch: token for "${data.action}", expected "${action}"`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("turnstile error", e);
    return false;
  }
}
