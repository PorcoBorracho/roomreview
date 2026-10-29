// Compartido entre cliente y servidor. Debe coincidir con el CHECK de la tabla boards.
export const RESERVED_SLUGS = [
  "login", "privacy", "delete", "api", "admin", "streamer", "queue", "deck",
  "new", "settings", "static", "public", "assets", "favicon", "robots", "sitemap",
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

export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters.";
  if (slug.length > 48) return "Use 48 characters or fewer.";
  if (!SLUG_RE.test(slug)) return "Use lowercase letters, numbers and single hyphens only.";
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return "That address is reserved. Pick another.";
  return null;
}
