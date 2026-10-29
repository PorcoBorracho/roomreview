"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { clientKey } from "@/lib/request";
import { createSession, destroySession, type Role } from "@/lib/session";

export type LoginState = { error?: string };

const loginSchema = z.object({
  role: z.enum(["admin", "viewer"]),
  password: z.string().min(1).max(256),
  next: z.string().max(200).optional(),
});

const SAFE_NEXT: Record<Role, string[]> = {
  admin: ["/admin", "/streamer"],
  viewer: ["/streamer"],
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    role: formData.get("role"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Incorrect password. Access denied." };
  const { role, password, next } = parsed.data;

  // Anti fuerza bruta: por IP y global por rol
  const ipOk = await rateLimit(await clientKey(`login:${role}`), 5, 15 * 60);
  const globalOk = await rateLimit(`login:${role}:global`, 60, 15 * 60);
  if (!ipOk || !globalOk) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }

  const hash = role === "admin" ? serverEnv.adminPasswordHash : serverEnv.viewerPasswordHash;
  if (!(await verifyPassword(password, hash))) {
    return { error: "Incorrect password. Access denied." };
  }

  await createSession(role);
  const dest = next && SAFE_NEXT[role].includes(next) ? next : role === "admin" ? "/admin" : "/streamer";
  redirect(dest);
}

export async function logout() {
  await destroySession();
  redirect("/");
}
