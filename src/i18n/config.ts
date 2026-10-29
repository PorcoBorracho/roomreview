// Idiomas de la web. El primero es el de respaldo.
export const LOCALES = ["en", "es", "pt", "fr", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

/** Nombre de cada idioma en su propio idioma (para el selector) */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  ja: "日本語",
};

/** Etiqueta BCP 47 para fechas y números */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-GB", es: "es-ES", pt: "pt-BR", fr: "fr-FR", ja: "ja-JP" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Elige el mejor idioma de una cabecera Accept-Language ("es-ES,es;q=0.9,en;q=0.8") */
export function matchAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const prefs = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((p) => p.lang && !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) if (isLocale(p.lang)) return p.lang;
  return DEFAULT_LOCALE;
}

export function formatDate(locale: Locale, iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(iso).toLocaleString(LOCALE_TAGS[locale], opts);
}
