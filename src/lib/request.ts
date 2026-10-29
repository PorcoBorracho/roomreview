import "server-only";
import { headers } from "next/headers";
import { hmac } from "./crypto";

/**
 * IP del cliente para los límites de intentos.
 * En Vercel, x-vercel-forwarded-for y x-real-ip los pone la plataforma y el visitante no puede
 * falsificarlos. x-forwarded-for solo es fiable detrás de un proxy propio: queda como último recurso.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function clientKey(scope: string): Promise<string> {
  return `${scope}:${hmac(await clientIp())}`;
}
