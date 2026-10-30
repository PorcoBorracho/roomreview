"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, UserRoundPlus, X } from "lucide-react";
import { addTeamAdmin, createTeamAdmin, removeTeamAdmin } from "@/actions/streamers";
import type { TeamMember } from "@/lib/streamers";
import { MAX_TEAM } from "@/lib/limits";
import { useT } from "@/i18n/client";
import { Pill } from "./Pill";
import { SecretDialog, type Secret } from "./AdminsManager";

type Props = {
  streamerId: string;
  team: TeamMember[];
  /** Vista compacta (página Streamers): solo añadir Admins existentes */
  compact?: boolean;
  /** El streamer puede además crear cuentas nuevas */
  canCreate?: boolean;
  otpHours?: number;
  onError: (e: string | null) => void;
};

const btn = "pressable flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50";

/** Admins del equipo de un streamer (máximo MAX_TEAM): quitar, añadir uno existente o crear uno nuevo. */
export default function TeamEditor({ streamerId, team, compact = false, canCreate = false, otpHours = 72, onError }: Props) {
  const t = useT();
  const tt = t.team;
  const router = useRouter();
  const [members, setMembers] = useState(team);
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  useEffect(() => setMembers(team), [team]);
  const full = members.length >= MAX_TEAM;

  async function add() {
    const u = username.trim().toLowerCase();
    if (!u) return;
    onError(null);
    setBusy(true);
    if (mode === "new") {
      const r = await createTeamAdmin(u);
      setBusy(false);
      if (!r.ok) return onError(r.error);
      setSecret({ title: t.admins.createdTitle(r.username), username: r.username, password: r.password });
    } else {
      const r = await addTeamAdmin(streamerId, u);
      setBusy(false);
      if (!r.ok) return onError(r.error);
    }
    setUsername("");
    router.refresh();
  }

  async function remove(id: string) {
    onError(null);
    const before = members;
    setMembers(members.filter((m) => m.id !== id)); // optimista
    const r = await removeTeamAdmin(streamerId, id);
    if (!r.ok) { setMembers(before); onError(r.error); }
    router.refresh();
  }

  return (
    <div className={compact ? "mt-2" : ""}>
      {members.length === 0 ? (
        <p className={`text-sm text-subtle ${compact ? "" : "rounded-xl border border-dashed border-line px-4 py-6 text-center"}`}>{tt.empty}</p>
      ) : (
        <ul className={compact ? "flex flex-wrap gap-2" : "divide-y divide-line rounded-xl border border-line"}>
          {members.map((m) => (
            <li key={m.id} className={compact
              ? "flex items-center gap-1.5 rounded-lg border border-line bg-card py-1 pr-1 pl-2.5 text-[13px]"
              : "flex items-center justify-between gap-3 px-4 py-3 text-sm"}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-ink">{m.username}</span>
                {m.status !== "active" && <Pill tone="warning">{t.admins.status[m.status]}</Pill>}
              </span>
              <button type="button" onClick={() => remove(m.id)} aria-label={tt.remove(m.username)} title={tt.remove(m.username)}
                className="pressable flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-raised hover:text-danger-text">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-3 text-xs text-subtle">{tt.full(MAX_TEAM)}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {canCreate && (
            <div role="radiogroup" aria-label={tt.addTitle} className="grid gap-2 sm:grid-cols-2">
              {(["existing", "new"] as const).map((k) => (
                <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3.5 py-3 has-checked:border-accent has-checked:bg-accent/[0.06]">
                  <input type="radio" name={`team-mode-${streamerId}`} checked={mode === k} onChange={() => setMode(k)} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{k === "existing" ? tt.existing : tt.createNew}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{k === "existing" ? tt.existingHint : tt.createNewHint(otpHours)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label htmlFor={`team-${streamerId}`} className="sr-only">{t.admins.username}</label>
            <input id={`team-${streamerId}`} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder={mode === "new" ? tt.newUsername : tt.adminUsername} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={32}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
              className={`field min-w-0 flex-1 ${compact ? "h-10 py-0" : ""}`} />
            <button type="button" onClick={add} disabled={busy || username.trim().length < 3} className={btn}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "new" ? <UserRoundPlus className="size-4" /> : <UserPlus className="size-4" />}
              {mode === "new" ? tt.create : tt.add}
            </button>
          </div>
        </div>
      )}
      <SecretDialog secret={secret} otpHours={otpHours} onClose={() => setSecret(null)} />
    </div>
  );
}
