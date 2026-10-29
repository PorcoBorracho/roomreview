import en, { type Dict } from "./en";
import es from "./es";
import pt from "./pt";
import fr from "./fr";
import ja from "./ja";
import type { Locale } from "../config";

export type { Dict };
export const DICTS: Record<Locale, Dict> = { en, es, pt, fr, ja };

/** Traduce una clave de error (de las validaciones) o devuelve el mensaje genérico */
export function errorText(t: Dict, key: string | undefined): string {
  return (key && (t.errors as Record<string, string>)[key]) || t.errors.invalidData;
}
