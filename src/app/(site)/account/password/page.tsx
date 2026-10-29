import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSession, loginUrl } from "@/lib/session";
import { getT } from "@/i18n/server";
import { ChangePasswordForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).account.forcedTitle, robots: { index: false } };
}

/** Primera entrada con una contraseña de un solo uso: hay que elegir una propia antes de hacer nada más. */
export default async function ForcedPasswordPage() {
  const s = await getSession();
  if (!s.account) redirect(loginUrl("/account"));
  if (!s.account.mustChange) redirect("/account");
  const t = await getT();
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="enter-zoom w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
        <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
          <KeyRound className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-strong">{t.account.forcedTitle}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t.account.forcedIntro}</p>
        <ChangePasswordForm forced />
      </div>
    </div>
  );
}
