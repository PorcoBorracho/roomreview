import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession, HOME_PANEL, loginUrl } from "@/lib/session";
import { getT } from "@/i18n/server";
import { TwoFactorPanel } from "@/components/AccountForms";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).twoFactor.title, robots: { index: false } };
}

/** Paso obligatorio del Owner: activar la verificación en dos pasos antes de usar el panel. */
export default async function RequiredTwoFactorPage() {
  const s = await getSession();
  if (!s.account) redirect(loginUrl("/account"));
  if (s.account.mustChange) redirect("/account/password");
  if (!s.account.mustEnrollTotp) redirect(HOME_PANEL);
  const t = await getT();
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="enter-zoom w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
          <ShieldCheck className="size-5" />
        </div>
        <p className="mb-4 text-sm leading-relaxed text-pretty text-muted">{t.twoFactor.ownerIntro}</p>
        <TwoFactorPanel enabledSince={null} required doneHref={HOME_PANEL} />
      </div>
    </div>
  );
}
