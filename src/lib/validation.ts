import { z } from "zod";
import { slugProblem } from "./slug";
import { PLATFORM_KEYS } from "./platforms";

// Quita caracteres de control (salvo saltos de línea en la descripción)
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").trim();

export const submissionSchema = z.object({
  boardId: z.uuid("Invalid board"),
  username: z
    .string()
    .transform((s) => clean(s).replace(/^@+/, ""))
    .pipe(z.string().min(1, "Username is required").max(40).regex(/^[\p{L}\p{N}_.\-]+$/u, "Username: only letters, numbers, _ . -")),
  email: z.string().transform(clean).pipe(z.email("Invalid email address").max(254)),
  country: z.string().transform(clean).pipe(z.string().min(2, "Country is required").max(60).regex(/^[\p{L}\p{M} .,'()\-]+$/u, "Invalid country")),
  description: z
    .string()
    .transform((s) => clean(s.replace(/\r\n/g, "\n")))
    .pipe(z.string().min(1, "Description is required").max(2000, "Description: max 2000 characters")),
  files: z
    .array(
      z.object({
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().positive().max(6 * 1024 * 1024, "Each photo must be under 6 MB"),
      }),
    )
    .min(1, "Please upload at least 1 photo")
    .max(5, "Max 5 photos"),
  turnstileToken: z.string().min(1, "Please complete the anti-bot check").max(2048),
  // Consentimientos explícitos (RGPD art. 7): casillas sin marcar por defecto, todas obligatorias
  consents: z.object({
    age: z.boolean().refine((v) => v === true, "You must confirm you meet the minimum age"),
    privacy: z.boolean().refine((v) => v === true, "You must accept the privacy policy"),
    broadcast: z.boolean().refine((v) => v === true, "You must agree to the photo and broadcast terms"),
    thirdParties: z.boolean().refine((v) => v === true, "You must confirm your photos don't show other people or sensitive information"),
  }),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export const uuidSchema = z.uuid();

/** Código que recibe quien envía para poder borrar su entrega sin cuenta. */
export const deletionCodeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^RR[A-Z0-9]{20}$/, "That code doesn't look right. It starts with RR- and has 20 more characters."));

export const boardSchema = z.object({
  streamerName: z
    .string()
    .transform((s) => clean(s).replace(/^@+/, ""))
    .pipe(z.string().min(1, "Add the streamer's name").max(40, "Streamer: max 40 characters")
      .regex(/^[\p{L}\p{N} _.\-]+$/u, "Streamer: letters, numbers, spaces, _ . - only")),
  platform: z.enum(PLATFORM_KEYS as [string, ...string[]], "Pick a platform"),
  title: z.string().transform(clean).pipe(z.string().min(1, "Give the board a title").max(80, "Title: max 80 characters")),
  slug: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .superRefine((s, ctx) => {
      const p = slugProblem(s);
      if (p) ctx.addIssue({ code: "custom", message: `Address: ${p}` });
    }),
  description: z
    .string()
    .transform((s) => clean(s.replace(/\r\n/g, "\n")))
    .pipe(z.string().max(1000, "Description: max 1000 characters")),
  isActive: z.boolean(),
  submissionsOpen: z.boolean(),
  peopleAllowed: z.boolean(),
});
export type BoardInput = z.input<typeof boardSchema>;

export const streamerPasswordSchema = z
  .string()
  .max(128, "Streamer password: max 128 characters")
  .refine((s) => s.trim().length >= 10, "Streamer password: use at least 10 characters")
  .refine((s) => !/^\s|\s$/.test(s), "Streamer password can't start or end with a space");

export const createBoardSchema = boardSchema.extend({ streamerPassword: streamerPasswordSchema });
export type CreateBoardInput = z.input<typeof createBoardSchema>;
