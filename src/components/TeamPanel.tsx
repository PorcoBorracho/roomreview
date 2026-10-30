"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/streamers";
import { MAX_TEAM } from "@/lib/limits";
import { useT } from "@/i18n/client";
import FormError from "./FormError";
import TeamEditor from "./TeamEditor";

export default function TeamPanel({ streamerId, team, otpHours }: { streamerId: string; team: TeamMember[]; otpHours: number }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="mt-8 rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
      <h2 className="text-base font-semibold text-strong">{t.streamers.teamTitle(team.length, MAX_TEAM)}</h2>
      <p className="mt-1 mb-4 text-sm leading-relaxed text-muted">{t.team.canDo}</p>
      <TeamEditor streamerId={streamerId} team={team} canCreate otpHours={otpHours} onError={setError} />
      {error && <FormError code={error} className="mt-3" />}
    </section>
  );
}
