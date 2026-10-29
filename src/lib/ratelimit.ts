import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/** Devuelve true si la petición está permitida. Atómico en Postgres. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate_limit_hit error", error.message);
    return false; // si falla, mejor denegar que permitir
  }
  return data === true;
}

/** Borra un contador: se usa tras un login correcto para que solo cuenten los intentos fallidos. */
export async function resetRateLimit(key: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("rate_limit_reset", { p_key: key });
  if (error) console.error("rate_limit_reset error", error.message);
}
