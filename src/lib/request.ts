import "server-only";
import { headers } from "next/headers";
import { hmac } from "./crypto";

/** IP del cliente (Vercel pone la real en x-real-ip / primer x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function clientKey(scope: string): Promise<string> {
  return `${scope}:${hmac(await clientIp())}`;
}
