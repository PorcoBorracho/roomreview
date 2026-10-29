// Compartido entre cliente y servidor. Debe coincidir con el CHECK de boards.platform.
// Los nombres que se muestran están en el diccionario (src/i18n/dict, "platforms").
export const PLATFORM_KEYS = ["twitch", "youtube", "kick", "tiktok", "other"] as const;
export type Platform = (typeof PLATFORM_KEYS)[number];
