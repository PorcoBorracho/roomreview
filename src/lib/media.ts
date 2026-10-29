import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { BUCKET } from "./env";

/** Genera URLs firmadas temporales para un conjunto de rutas privadas. */
export async function signPaths(paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(chunk, expiresIn);
    if (error) throw new Error(error.message);
    for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  }
  return map;
}

/** Comprueba la "firma mágica" real del archivo (no fiarse del tipo que dice el cliente). */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabaseAdmin().storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error("storage remove error", error.message);
  }
}
