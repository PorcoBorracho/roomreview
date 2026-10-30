import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { isSiteAdmin, requireAccountPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/i18n/config";
import { ChangePasswordForm, OwnerResetPanel, TwoFactorPanel } from "@/components/AccountForms";
import StreamerAvatar from "@/components/StreamerAvatar";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).account.title, robots: { index: false } };
}

export default async function AccountPage() {
  const acc = await requireAccountPage("/account");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const { data } = await supabaseAdmin().from("admins").select("totp_enabled_at, avatar_url, approved_at").eq("id", acc.id).maybeSingle();
  const day = (iso: string) => formatDate(locale, iso, { day: "numeric", month: "long", year: "numeric" });
  const since = data?.totp_enabled_at ? day(data.totp_enabled_at as string) : null;

  if (acc.role === "streamer") {
    return (
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.account.title}</h1>
        <section className="mt-8 rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
          <div className="flex items-center gap-4">
            <StreamerAvatar streamer={{ displayName: acc.displayName, avatarUrl: (data?.avatar_url as string | null) ?? null }} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-strong">{acc.displayName}</p>
              <p className="mt-0.5 text-sm text-muted">@{acc.username} · {t.header.roles.streamer}</p>
              {data?.approved_at && <p className="mt-0.5 text-[13px] text-subtle">{t.account.approvedOn(day(data.approved_at as string))}</p>}
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-pretty text-muted">{t.account.twitchText}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/${acc.username}`} target="_blank" rel="noreferrer"
              className="pressable flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-semibold text-ink hover:border-line-strong">
              <ExternalLink className="size-4 text-subtle" /> {t.dashboard.myPage}
            </a>
            <a href="https://www.twitch.tv/settings/security" target="_blank" rel="noreferrer noopener"
              className="pressable flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-semibold text-ink hover:border-line-strong">
              <ExternalLink className="size-4 text-subtle" /> {t.account.twitchSecurity}
            </a>
          </div>
        </section>
      </div>
    );
  }

  const owner = acc.role === "owner";
  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.account.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.account.signedInAs(acc.username, t.header.roles[acc.role])}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
          <h2 className="text-base font-semibold text-strong">{t.account.changeTitle}</h2>
          <ChangePasswordForm forced={false} />
        </section>
        <div className="grid gap-6">
          <section className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
            <TwoFactorPanel enabledSince={since} recommended={isSiteAdmin(acc)} required={owner} />
          </section>
          {owner && (
            <section className="rounded-2xl border border-danger/30 bg-card p-5 shadow-raised sm:p-6">
              <OwnerResetPanel />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
