"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Pause, Play, TriangleAlert, Tv, X } from "lucide-react";
import { setStreamerStatus } from "@/actions/streamers";
import type { StreamerAdminItem } from "@/lib/streamers";
import { MAX_TEAM } from "@/lib/limits";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/config";
import Segmented from "./Segmented";
import FormError from "./FormError";
import HoldButton from "./HoldButton";
import StreamerAvatar from "./StreamerAvatar";
import TeamEditor from "./TeamEditor";

type Status = "pending" | "active" | "suspended";
const TABS: Status[] = ["pending", "active", "suspended"];
const rowBtn = "pressable flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50";

export default function StreamersManager({ streamers, status, twitchConfigured }: { streamers: StreamerAdminItem[]; status: Status; twitchConfigured: boolean }) {
  const t = useT();
  const s = t.streamers;
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const counts = Object.fromEntries(TABS.map((k) => [k, streamers.filter((x) => x.status === k).length])) as Record<Status, number>;
  const list = streamers.filter((x) => x.status === status);
  const date = (iso: string) => formatDate(locale, iso, { day: "numeric", month: "short", year: "numeric" });

  function run(id: string, action: "approve" | "reject" | "suspend" | "reactivate") {
    setError(null);
    setBusy(id);
    start(async () => {
      const r = await setStreamerStatus(id, action);
      setBusy(null);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <section className="mx-auto max-w-[1100px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{s.title}</h1>
          <p className="mt-1 text-sm text-muted">{s.intro}</p>
        </div>
        <Segmented
          ariaLabel={s.filter}
          items={TABS.map((k) => ({ key: k, label: counts[k] ? `${s.tabs[k]} · ${counts[k]}` : s.tabs[k] }))}
          active={status}
          onSelect={(k) => router.replace(k === "pending" ? pathname : `${pathname}?status=${k}`, { scroll: false })}
        />
      </header>

      {!twitchConfigured && (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" /> {s.twitchOff}
        </p>
      )}

      {error && (
        <div role="alert" className="enter-fade mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
          <FormError code={error} className="flex-1" />
          <button onClick={() => setError(null)} className="text-xs font-semibold text-danger-text underline">{t.common.dismiss}</button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <Tv className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-base font-semibold text-strong">{s.empty[status]}</p>
          {status === "pending" && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{s.emptyPendingText}</p>}
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-raised">
          {list.map((x) => (
            <li key={x.id} className="px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <StreamerAvatar streamer={x} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-semibold text-strong">{x.displayName}</span>
                      <a href={`https://www.twitch.tv/${x.login}`} target="_blank" rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[13px] text-subtle hover:text-strong">
                        twitch.tv/{x.login} <ExternalLink className="size-3" />
                      </a>
                    </p>
                    <p className="mt-0.5 text-[13px] text-subtle">
                      {x.status === "pending" ? s.requested(date(x.createdAt)) : s.since(date(x.approvedAt ?? x.createdAt))}
                      {x.status !== "pending" && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="tabular-nums">{t.admins.boards(x.boards)}</span>
                          <span className="mx-1.5">·</span>
                          {t.admins.lastLogin(x.lastLoginAt ? date(x.lastLoginAt) : t.common.never)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {x.status === "pending" && (
                    <>
                      <button type="button" disabled={busy === x.id} onClick={() => run(x.id, "approve")}
                        className="pressable flex h-8 items-center gap-1.5 rounded-lg bg-success px-3 text-[13px] font-semibold text-white hover:bg-success-hover disabled:opacity-60">
                        {busy === x.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {s.approve}
                      </button>
                      <HoldButton holdMs={900} disabled={busy === x.id} onConfirm={() => run(x.id, "reject")}
                        label={s.reject} holdingLabel={t.common.keepHolding} icon={<X className="size-4" />}
                        className="flex h-8 items-center rounded-lg border border-danger/40 px-2.5 text-[13px] font-semibold text-danger-text hover:border-danger/70"
                        fillClassName="bg-danger text-white" />
                    </>
                  )}
                  {x.status === "active" && (
                    <>
                      <a href={`/${x.login}`} target="_blank" rel="noreferrer" className={rowBtn}>
                        <ExternalLink className="size-4 text-subtle" /> {s.publicPage}
                      </a>
                      <span title={s.suspendHint}>
                        <HoldButton holdMs={1200} disabled={busy === x.id} onConfirm={() => run(x.id, "suspend")}
                          label={s.suspend} holdingLabel={t.common.keepHolding} icon={<Pause className="size-4" />}
                          className="flex h-8 items-center rounded-lg border border-danger/40 px-2.5 text-[13px] font-semibold text-danger-text hover:border-danger/70"
                          fillClassName="bg-danger text-white" />
                      </span>
                    </>
                  )}
                  {x.status === "suspended" && (
                    <button type="button" disabled={busy === x.id} onClick={() => run(x.id, "reactivate")} className={rowBtn}>
                      {busy === x.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {s.reactivate}
                    </button>
                  )}
                </div>
              </div>
              {x.status === "active" && (
                <div className="mt-3 rounded-xl border border-line bg-well px-3.5 py-3 lg:ml-14">
                  <p className="text-xs font-semibold text-subtle">{s.teamTitle(x.team.length, MAX_TEAM)}</p>
                  <TeamEditor streamerId={x.id} team={x.team} compact onError={setError} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-subtle">{s.hint}</p>
    </section>
  );
}
