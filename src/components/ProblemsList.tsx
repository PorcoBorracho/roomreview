"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Trash2, Flag, Mail, Loader2 } from "lucide-react";
import { deleteReport, setReportStatus } from "@/actions/problems";
import { useLocale, useT } from "@/i18n/client";
import { formatDate, LOCALE_NAMES, isLocale } from "@/i18n/config";
import Segmented from "./Segmented";
import HoldButton from "./HoldButton";
import FormError from "./FormError";
import { Pill } from "./Pill";

export type ProblemItem = {
  id: string; page: string; category: string; message: string; email: string | null; locale: string;
  status: "open" | "resolved"; createdAt: string; resolvedAt: string | null;
  board: { slug: string; title: string } | null;
};

const TONE: Record<string, "warning" | "accent" | "muted"> = { privacy: "warning", content: "warning", bug: "accent", access: "accent", other: "muted" };

export default function ProblemsList({ items, status, openCount }: { items: ProblemItem[]; status: "open" | "resolved" | "all"; openCount: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const dt = (iso: string) => formatDate(locale, iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, hide: boolean) {
    setError(null);
    setBusy(id);
    if (hide) setHidden((h) => new Set(h).add(id)); // optimista: sale de la lista al instante
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        setError(r.error ?? "db");
        setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
      }
      router.refresh();
    });
  }

  const shown = items.filter((i) => !hidden.has(i.id));

  return (
    <section className="mx-auto max-w-[1100px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.problems.title}</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">{t.problems.summary(openCount)}</p>
        </div>
        <Segmented kind="nav" ariaLabel={t.queue.filterStatus} active={status}
          items={(["open", "resolved", "all"] as const).map((k) => ({ key: k, label: t.problems.tabs[k], href: k === "open" ? "/problems" : `/problems?status=${k}` }))} />
      </header>

      {error && (
        <div role="alert" className="enter-fade mt-6 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
          <FormError code={error} />
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <Flag className="mx-auto size-8 text-subtle" />
          <h2 className="mt-3 text-base font-semibold text-strong">{status === "open" ? t.problems.emptyOpen : t.problems.emptyOther}</h2>
          {status === "open" && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.problems.emptyOpenText}</p>}
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {shown.map((p) => (
            <li key={p.id} className="rounded-2xl border border-line bg-card p-5 shadow-raised">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-subtle">
                <Pill tone={TONE[p.category] ?? "muted"}>{t.report.categories[p.category] ?? p.category}</Pill>
                {p.status === "resolved" && <Pill tone="success">{p.resolvedAt ? t.problems.resolvedOn(dt(p.resolvedAt)) : t.problems.tabs.resolved}</Pill>}
                <time dateTime={p.createdAt}>{dt(p.createdAt)}</time>
                {isLocale(p.locale) && <span>· {LOCALE_NAMES[p.locale]}</span>}
              </div>
              {/* Texto de un visitante: se muestra como texto plano (React lo escapa) */}
              <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line break-words text-ink">{p.message}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                <div>
                  <dt className="text-subtle">{t.problems.board}</dt>
                  <dd className="mt-0.5 truncate text-ink">{p.board ? <Link href={`/${p.board.slug}`} className="text-accent-text hover:underline">{p.board.title}</Link> : "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t.problems.page}</dt>
                  <dd className="mt-0.5 truncate font-mono text-ink">{p.page || "—"}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t.problems.replyTo}</dt>
                  <dd className="mt-0.5 truncate text-ink">
                    {p.email ? <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 text-accent-text hover:underline"><Mail className="size-3.5" />{p.email}</a> : t.problems.noEmail}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" disabled={busy === p.id}
                  onClick={() => run(p.id, () => setReportStatus(p.id, p.status === "open" ? "resolved" : "open"), status !== "all")}
                  className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-semibold text-ink hover:bg-line disabled:opacity-60">
                  {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : p.status === "open" ? <CheckCircle2 className="size-4" /> : <RotateCcw className="size-4" />}
                  {p.status === "open" ? t.problems.resolve : t.problems.reopen}
                </button>
                <HoldButton holdMs={1000} disabled={busy === p.id} onConfirm={() => run(p.id, () => deleteReport(p.id), true)}
                  label={t.problems.deleteButton} holdingLabel={t.common.keepHolding} icon={<Trash2 className="size-4" />}
                  className="flex h-9 items-center rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-danger-text"
                  fillClassName="bg-danger text-white" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
