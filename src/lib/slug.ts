// Compartido entre cliente y servidor. Debe coincidir con el CHECK de la tabla boards (schema.sql).
export const RESERVED_SLUGS = [
  "login", "privacy", "delete", "api", "admin", "admins", "streamer", "queue", "deck",
  "new", "settings", "static", "public", "assets", "favicon", "robots", "sitemap",
  "account", "problems", "report", "contact", "setup", "logout", "audit", "activity",
] as const;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
