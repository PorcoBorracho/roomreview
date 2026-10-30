import type { Metadata } from "next";
import { requireStreamerPage } from "@/lib/session";
import { teamsOf } from "@/lib/streamers";
import { OTP_HOURS } from "@/lib/accounts";
import { MAX_TEAM } from "@/lib/limits";
import { getT } from "@/i18n/server";
import TeamPanel from "@/components/TeamPanel";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).team.title, robots: { index: false } };
}

/** Equipo del streamer: hasta 2 Admins que crean y moderan sus boards. */
export default async function TeamPage() {
  const acc = await requireStreamerPage("/team");
  const t = await getT();
  const team = (await teamsOf([acc.id])).get(acc.id) ?? [];
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.team.title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{t.team.intro(MAX_TEAM)}</p>
      <TeamPanel streamerId={acc.id} team={team} otpHours={OTP_HOURS} />
    </div>
  );
}
