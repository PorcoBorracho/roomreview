// Compartido entre cliente y servidor.

/**
 * Primer nivel de la web: páginas propias. Un streamer de Twitch con uno de estos logins no podría tener
 * su página en /{login}, así que no se acepta su registro. Debe incluir todas las rutas de src/app/(site).
 */
export const RESERVED_PATHS = [
  "login", "privacy", "delete", "api", "admin", "admins", "streamer", "streamers", "queue", "deck",
  "new", "settings", "static", "public", "assets", "favicon", "robots", "sitemap", "panel", "team",
  "account", "problems", "report", "contact", "setup", "logout", "audit", "activity", "search", "auth",
] as const;

/** Nombres de board que no se aceptan (coincide con el CHECK de la tabla boards) */
export const RESERVED_SLUGS = RESERVED_PATHS;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Login de Twitch tal como lo guardamos (en minúsculas) */
export const LOGIN_RE = /^[a-z0-9_]{1,40}$/;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/** null si es válido; "reserved" si es una ruta de la web; "invalid" en otro caso */
export function slugProblem(slug: string): "invalid" | "reserved" | null {
  if (slug.length < 3 || slug.length > 48 || !SLUG_RE.test(slug)) return "invalid";
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return "reserved";
  return null;
}

export const isReservedPath = (login: string) => (RESERVED_PATHS as readonly string[]).includes(login);

/** Dirección pública de un board */
export const boardPath = (login: string, slug: string) => `/${login}/${slug}`;
