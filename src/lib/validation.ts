import { z } from "zod";
import { slugProblem } from "./slug";
import { PLATFORM_KEYS } from "./platforms";
import { ALLOWED_TYPES, MAX_DESCRIPTION, MAX_FILE_BYTES, MAX_FILES } from "./limits";

/*
 * Los mensajes de error son CLAVES del diccionario (src/i18n/dict, sección "errors"),
 * no textos: así cada visitante los ve en su idioma. Se traducen con errorText().
 */

// Quita caracteres de control y de dirección del texto (salvo saltos de línea en la descripción)
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").trim();

/** Primer error de un resultado de zod, como clave del diccionario */
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "invalidData";

export const submissionSchema = z.object({
  boardId: z.uuid("boardNotFound"),
  username: z
    .string("usernameRequired")
    .transform((s) => clean(s).replace(/^@+/, ""))
    .pipe(z.string().min(1, "usernameRequired").max(40, "usernameChars").regex(/^[\p{L}\p{N}_.\-]+$/u, "usernameChars")),
  email: z.string("emailInvalid").transform(clean).pipe(z.email("emailInvalid").max(254, "emailInvalid")),
  country: z
    .string("countryInvalid")
    .transform(clean)
    .pipe(z.string().min(2, "countryInvalid").max(60, "countryInvalid").regex(/^[\p{L}\p{M} .,'()\-]+$/u, "countryInvalid")),
  description: z
    .string("descriptionRequired")
    .transform((s) => clean(s.replace(/\r\n/g, "\n")))
    .pipe(z.string().min(1, "descriptionRequired").max(MAX_DESCRIPTION, "descriptionTooLong")),
  files: z
    .array(
      z.object({
        type: z.enum(ALLOWED_TYPES, "uploadInvalid"),
        size: z.number().int().positive().max(MAX_FILE_BYTES, "photoTooLarge"),
      }),
      "photosRange",
    )
    .min(1, "photosRange")
    .max(MAX_FILES, "photosRange"),
  turnstileToken: z.string("captchaMissing").min(1, "captchaMissing").max(2048, "captchaFailed"),
  // Consentimientos explícitos (RGPD art. 7): casillas sin marcar por defecto, todas obligatorias
  consents: z.object({
    age: z.boolean().refine((v) => v === true, "consentRequired"),
    privacy: z.boolean().refine((v) => v === true, "consentRequired"),
    broadcast: z.boolean().refine((v) => v === true, "consentRequired"),
    thirdParties: z.boolean().refine((v) => v === true, "consentRequired"),
  }),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export const uuidSchema = z.uuid();

/** Código que recibe quien envía para poder borrar su entrega sin cuenta. */
export const deletionCodeSchema = z
  .string("codeInvalid")
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^RR[A-Z0-9]{20}$/, "codeInvalid"));

export const boardSchema = z.object({
  streamerName: z
    .string("streamerRequired")
    .transform((s) => clean(s).replace(/^@+/, ""))
    .pipe(z.string().min(1, "streamerRequired").max(40, "streamerRequired").regex(/^[\p{L}\p{N} _.\-]+$/u, "streamerRequired")),
  platform: z.enum(PLATFORM_KEYS, "invalidData"),
  title: z.string("titleRequired").transform(clean).pipe(z.string().min(1, "titleRequired").max(80, "titleRequired")),
  slug: z
    .string("slugInvalid")
    .transform((s) => s.trim().toLowerCase())
    .superRefine((s, ctx) => {
      const p = slugProblem(s);
      if (p) ctx.addIssue({ code: "custom", message: p === "reserved" ? "slugReserved" : "slugInvalid" });
    }),
  description: z
    .string()
    .transform((s) => clean(s.replace(/\r\n/g, "\n")))
    .pipe(z.string().max(1000, "descriptionTooLong")),
  isActive: z.boolean(),
  submissionsOpen: z.boolean(),
  peopleAllowed: z.boolean(),
});
export type BoardInput = z.input<typeof boardSchema>;

export const boardPasswordSchema = z
  .string("boardPasswordShort")
  .max(128, "boardPasswordShort")
  .refine((s) => s.trim().length >= 10 && !/^\s|\s$/.test(s), "boardPasswordShort");

export const createBoardSchema = boardSchema
  .extend({ streamerPassword: boardPasswordSchema, moderatorPassword: boardPasswordSchema })
  .refine((b) => b.streamerPassword !== b.moderatorPassword, { message: "passwordSameAsAdmin", path: ["moderatorPassword"] });
export type CreateBoardInput = z.input<typeof createBoardSchema>;

/* ------------------------------ Cuentas ------------------------------ */

export const usernameSchema = z
  .string("usernameInvalid")
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/, "usernameInvalid"));

/** Contraseña de una cuenta: 12+ caracteres y que no contenga el nombre de usuario */
export function accountPasswordProblem(password: string, username: string): string | null {
  if (password.length < 12 || password.length > 256) return "passwordTooShort";
  if (username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) return "passwordHasUsername";
  return null;
}

export const totpCodeSchema = z
  .string("totpInvalid")
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "totpInvalid"));

/* ------------------------------ Problemas ------------------------------ */

export const REPORT_CATEGORIES = ["bug", "privacy", "content", "access", "other"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const reportSchema = z.object({
  category: z.enum(REPORT_CATEGORIES, "reportCategory"),
  message: z
    .string("reportMessage")
    .transform((s) => clean(s.replace(/\r\n/g, "\n")))
    .pipe(z.string().min(10, "reportMessage").max(2000, "descriptionTooLong")),
  email: z
    .string()
    .transform(clean)
    .pipe(z.union([z.literal(""), z.email("emailInvalid").max(254, "emailInvalid")])),
  page: z
    .string()
    .transform((s) => clean(s).slice(0, 200))
    // Solo rutas internas: nada de URLs externas en la base de datos
    .pipe(z.union([z.literal(""), z.string().regex(/^\/[A-Za-z0-9/_\-.]*$/, "invalidData")])),
  boardSlug: z.string().max(48).optional(),
  turnstileToken: z.string("captchaMissing").min(1, "captchaMissing").max(2048, "captchaFailed"),
});
