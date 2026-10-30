"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { useT } from "@/i18n/client";

/** Enlace para entrar (cabecera, sin sesión). No se muestra en la propia página de entrada ni en /setup. */
export default function SignInLink() {
  const t = useT();
  const path = usePathname();
  if (path === "/login" || path === "/setup") return null;
  return (
    <Link href="/login" prefetch={false}
      className="pressable flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
      <LogIn className="size-4" /> <span className="hidden sm:inline">{t.header.signIn}</span>
    </Link>
  );
}
