"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { createSession, destroySession, getSession } from "@/lib/session";
import { getBoardBySlug, getBoardPasswordHash } from "@/lib/boards";

export type LoginState = { error?: string };

const loginSchema = z.object({
  password: z.string().min(1).max(256),
  next: z.string().max(200).optional(),
});

/** Destinos permitidos tras el login (evita redirecciones abiertas). */
const NEXT_RE = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(queue|deck)$/;

// Hash de relleno: si un board no tiene contraseña, se compara contra esto para no revelarlo por el tiempo de respuesta
const DUMMY_HASH = "scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/**
 * Un solo campo de contraseña:
 *  · la de admin da acceso a todo;
 *  · si se entra desde el deck de un board, también vale la contraseña de streamer de ESE board.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Incorrect password." };
  const { password } = parsed.data;
  const m = parsed.data.next?.match(NEXT_RE);
  const next = m ? parsed.data.next! : "";
  const board = m && m[2] === "deck" ? await getBoardBySlug(m[1]) : null;

  // Anti fuerza bruta: por IP, por board y global
  const checks = await Promise.all([
    rateLimit(await clientKey("login"), 5, 15 * 60),
    rateLimit("login:global", 100, 15 * 60),
    board ? rateLimit(`login:board:${board.id}`, 20, 15 * 60) : Promise.resolve(true),
  ]);
  if (checks.includes(false)) return { error: "Too many attempts. Please wait 15 minutes." };

  const boardHash = board ? await getBoardPasswordHash(board.id) : null;
  // Se comprueban siempre ambas para que el tiempo de respuesta no revele cuál coincide
  const [isAdmin, isStreamer] = await Promise.all([
    verifyPassword(password, serverEnv.adminPasswordHash),
    board ? verifyPassword(password, boardHash ?? DUMMY_HASH) : Promise.resolve(false),
  ]);

  if (isAdmin) {
    await createSession({ role: "admin" });
    redirect(next || "/");
  }
  if (isStreamer && board && boardHash) {
    const current = await getSession();
    const boards = current?.role === "streamer" ? [...current.boards, board.id] : [board.id];
    await createSession({ role: "streamer", boards });
    redirect(`/${board.slug}/deck`);
  }
  return { error: "Incorrect password." };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
