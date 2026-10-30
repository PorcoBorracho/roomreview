// Límites compartidos entre el navegador y el servidor (sin secretos: se pueden importar en ambos).
// Los tamaños y los tipos deben coincidir con el bucket y create_submission de supabase/schema.sql.
export const BUCKET = "room-media";
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 6 * 1024 * 1024;
export const MAX_DESCRIPTION = 2000;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Vídeos (solo en boards que los permiten): uno por entrega, comprimido en el navegador y sin audio */
export const MAX_VIDEOS = 1;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES] as const;
export type MediaType = (typeof ALLOWED_TYPES)[number];
export const isVideoType = (t: string) => t.startsWith("video/");

/** Admins que puede tener el equipo de un streamer (debe coincidir con schema.sql) */
export const MAX_TEAM = 2;
/** Solicitudes de streamer pendientes como máximo, y días que se guardan sin aprobar */
export const MAX_PENDING_STREAMERS = 200;
export const PENDING_STREAMER_DAYS = 30;

/** Días que se guarda un problema reportado tras resolverlo (y máximo absoluto si nunca se resuelve) */
export const REPORT_RESOLVED_DAYS = 30;
export const REPORT_MAX_DAYS = 365;

/** Días que se guarda el registro de auditoría (debe coincidir con audit_log_guard en schema.sql) */
export const AUDIT_DAYS = 366;
