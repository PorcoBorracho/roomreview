"use client";

import { usePathname, useRouter } from "next/navigation";
import { History, KeyRound, UserRound, ShieldCheck, Tv, Globe, Bot, ChevronRight, ArrowUp } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import type { Dict } from "@/i18n/dict";
import { formatDate } from "@/i18n/config";
import Segmented from "./Segmented";

export type AuditEntry = {
  id: string; at: string; actorType: string; actorName: string; action: string; boardTitle: string;
  targetId: string | null; targetName: string | null; details: Record<string, unknown>; ipHash: string | null;
};

type Props = {
  entries: AuditEntry[];
  category: string;
  board: string;
  boards: { id: string; label: string }[];
  nextBefore: string | null;
  paged: boolean;
  days: number;
  categories: string[];
};

const ACTOR_ICON = { account: UserRound, moderator: ShieldCheck, streamer: Tv, visitor: Globe, system: Bot } as const;
// Las acciones fallidas o de borrado se marcan para que destaquen al revisar
const WARN = new Set([
  "account.login_failed", "account.mfa_failed", "board.login_failed", "board.deleted", "admin.deleted", "account.totp_disabled",
  "owner.password_reset", "streamer.suspended", "streamer.rejected",
]);

/** Texto legible de los detalles guardados (sin datos personales: solo qué se tocó) */
function detailChips(t: Dict, e: AuditEntry): string[] {
  const d = e.details;
  const out: string[] = [];
  const FIELD: Record<string, string> = {
    streamer: t.boardDialog.streamer, title: t.boardDialog.title, slug: t.boardDialog.address,
    description: t.boardDialog.description, isActive: t.boardDialog.activeLabel, submissionsOpen: t.boardDialog.acceptingLabel,
    peopleAllowed: t.boardDialog.peopleLabel, blurNew: t.boardDialog.blurLabel, allowVideos: t.boardDialog.videosLabel,
  };
  if (d.kind === "moderator") out.push(t.dashboard.moderatorAccess);
  if (d.kind === "streamer") out.push(t.dashboard.streamerAccess);
  if (typeof d.role === "string") out.push(t.header.roles[d.role] ?? d.role);
  if (d.flag === "isActive" || d.flag === "submissionsOpen") {
    out.push(`${d.flag === "isActive" ? t.dashboard.active : t.dashboard.accepting}: ${d.value ? t.audit.on : t.audit.off}`);
  }
  if (Array.isArray(d.fields)) out.push(...d.fields.map((f) => FIELD[String(f)] ?? String(f)));
  if (typeof d.slug === "string") out.push(`/${d.slug}`);
  if (typeof d.streamer === "string" && d.streamer) out.push(`@${d.streamer}`);
  if (d.isNew === true) out.push(t.audit.newRequest);
  if (d.page === "queue") out.push(t.board.queue);
  if (d.page === "deck") out.push(t.board.deck);
  if (d.mfa === true) out.push(t.audit.mfa);
  if (d.oneTime === true) out.push(t.audit.oneTime);
  if (d.reason === "otpExpired") out.push(t.audit.otpExpired);
  for (const k of ["submissions", "incomplete", "expired", "reports", "auditEntries", "pendingStreamers"]) {
    if (typeof d[k] === "number" && (d[k] as number) > 0) out.push(t.audit.count(t.audit.counts[k], d[k] as number));
  }
  return out;
}

export default function AuditLog({ entries, category, board, boards, nextBefore, paged, days, categories }: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function go(p: { type?: string; board?: string; before?: string | null }) {
    const sp = new URLSearchParams();
    const type = p.type ?? category;
    const b = p.board ?? board;
    if (type !== "all") sp.set("type", type);
    if (b) sp.set("board", b);
    if (p.before) sp.set("before", p.before);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: !!p.before });
  }

  const time = (iso: string) => formatDate(locale, iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <section className="mx-auto max-w-[1100px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.audit.title}</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-pretty text-muted">{t.audit.summary(days)}</p>
        </div>
        {boards.length > 0 && (
          <select value={board} onChange={(e) => go({ board: e.target.value })} aria-label={t.problems.board} className="field h-10 py-0 lg:w-64">
            <option value="">{t.audit.allBoards}</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        )}
      </header>

      <div className="mt-6 overflow-x-auto pb-1">
        <Segmented ariaLabel={t.audit.filterCategory} active={category} onSelect={(k) => go({ type: k })}
          items={categories.map((k) => ({ key: k, label: t.audit.categories[k] ?? k }))} />
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <History className="mx-auto size-8 text-subtle" />
          <h2 className="mt-3 text-base font-semibold text-strong">{t.audit.empty}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.audit.emptyText}</p>
        </div>
      ) : (
        <ol className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-raised">
          {entries.map((e) => {
            const Icon = ACTOR_ICON[e.actorType as keyof typeof ACTOR_ICON] ?? UserRound;
            const actor = e.actorType === "account" ? e.actorName : t.audit.actors[e.actorType] ?? e.actorType;
            const chips = detailChips(t, e);
            const warn = WARN.has(e.action);
            return (
              <li key={e.id} className="grid gap-x-4 gap-y-1.5 px-5 py-3.5 sm:grid-cols-[11.5rem_minmax(0,1fr)]">
                <time dateTime={e.at} className="text-[13px] text-subtle tabular-nums">{time(e.at)}</time>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-strong">
                      <Icon aria-hidden className="size-4 text-subtle" /> {actor}
                    </span>
                    <span className={warn ? "font-medium text-warning-text" : "text-ink"}>{t.audit.actions[e.action] ?? e.action}</span>
                    {e.targetName && (
                      <>
                        <ChevronRight aria-hidden className="size-3.5 text-subtle" />
                        <span className="font-medium text-strong">{e.targetName}</span>
                      </>
                    )}
                    {!e.targetName && e.targetId && (
                      <code className="rounded bg-well px-1.5 py-0.5 font-mono text-xs text-muted" title={e.targetId}>{e.targetId.slice(0, 8)}</code>
                    )}
                  </p>
                  {(e.boardTitle || chips.length > 0 || e.ipHash) && (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {e.boardTitle && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 font-medium text-accent-text">{e.boardTitle}</span>}
                      {chips.map((c) => <span key={c} className="rounded-md bg-raised px-1.5 py-0.5">{c}</span>)}
                      {e.ipHash && (
                        <span className="inline-flex items-center gap-1 font-mono text-subtle" title={t.audit.connection}>
                          <KeyRound aria-hidden className="size-3" />{e.ipHash.slice(0, 8)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {(nextBefore || paged) && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {paged && (
            <button onClick={() => go({ before: null })}
              className="pressable flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold text-muted hover:text-strong">
              <ArrowUp className="size-4" /> {t.audit.newest}
            </button>
          )}
          {nextBefore && (
            <button onClick={() => go({ before: nextBefore })}
              className="pressable flex h-10 items-center rounded-xl bg-raised px-4 text-sm font-semibold text-ink hover:bg-line">
              {t.audit.older}
            </button>
          )}
        </nav>
      )}
    </section>
  );
}
