// Content-Security-Policy con nonce por petición (se usa en src/proxy.ts).
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    "default-src 'self'",
    // Solo se ejecutan scripts con el nonce de esta petición; 'strict-dynamic' permite los que esos carguen
    // (p. ej. Turnstile vía next/script). El host de Cloudflare queda como respaldo para navegadores antiguos.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Los atributos style de React necesitan 'unsafe-inline' (no permite ejecutar código)
    "style-src 'self' 'unsafe-inline'",
    // Imágenes de perfil de los streamers: solo del CDN de Twitch
    `img-src 'self' blob: data: ${supabase} https://static-cdn.jtvnw.net`,
    "font-src 'self'",
    `connect-src 'self' ${supabase} https://challenges.cloudflare.com`,
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // Vídeos: los de las entregas (URLs firmadas de Supabase) y la vista previa local antes de enviar
    `media-src 'self' blob: ${supabase}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
