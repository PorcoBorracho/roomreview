import type { Metadata } from "next";
import { requireAccountPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/i18n/config";
import { ChangePasswordForm, TwoFactorPanel } from "@/components/AccountForms";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).account.title, robots: { index: false } };
}

export default async function AccountPage() {
  const acc = await requireAccountPage("/account");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const { data } = await supabaseAdmin().from("admins").select("totp_enabled_at").eq("id", acc.id).maybeSingle();
  const since = data?.totp_enabled_at ? formatDate(locale, data.totp_enabled_at as string, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.account.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.account.signedInAs(acc.username, t.header.roles[acc.role])}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
          <h2 className="text-base font-semibold text-strong">{t.account.changeTitle}</h2>
          <ChangePasswordForm forced={false} />
        </section>
        <section className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
          <TwoFactorPanel enabledSince={since} siteAdmin={acc.role === "site_admin"} />
        </section>
      </div>
    </div>
  );
}
