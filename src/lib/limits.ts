// Límites compartidos entre el navegador y el servidor (sin secretos: se pueden importar en ambos).
// MAX_FILE_BYTES y los tipos deben coincidir con el bucket de supabase/schema.sql.
export const BUCKET = "room-media";
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 6 * 1024 * 1024;
export const MAX_DESCRIPTION = 2000;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Días que se guarda un problema reportado tras resolverlo (y máximo absoluto si nunca se resuelve) */
export const REPORT_RESOLVED_DAYS = 30;
export const REPORT_MAX_DAYS = 365;

/** Días que se guarda el registro de auditoría (debe coincidir con audit_log_guard en schema.sql) */
export const AUDIT_DAYS = 366;
