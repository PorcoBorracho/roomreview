"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Inbox, Mail, Check, Trash2, Undo2, AlertCircle, ChevronLeft, ChevronRight, Loader2, X, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { approveSubmission, deleteSubmission, unapproveSubmission } from "@/actions/admin";
import type { AdminSubmission } from "@/lib/types";
import Lightbox from "./Lightbox";
import HoldButton from "./HoldButton";
import Segmented from "./Segmented";

type Status = "pending" | "approved" | "all";
type Props = {
  submissions: AdminSubmission[];
  filtered: number;
  total: number;
  status: Status;
  q: string;
  page: number;
  pageSize: number;
};

const TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];

export default function AdminQueue({ submissions, filtered, total, status, q, page, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const [viewer, setViewer] = useState<{ subId: string; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [showEmails, setShowEmails] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => setLeaving(new Set()), [submissions]);

  function go(params: { status?: Status; q?: string; page?: number }) {
    const sp = new URLSearchParams();
    const s = params.status ?? status;
    const query = params.q ?? search;
    if (s !== "pending") sp.set("status", s);
    if (query.trim()) sp.set("q", query.trim());
    if ((params.page ?? 1) > 1) sp.set("page", String(params.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => go({ q: search, page: 1 }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function run(id: string, action: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>, removes: boolean) {
    setError(null);
    setBusy({ id, action });
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.error ?? "That action didn't go through. Try again.");
      else if (removes) setLeaving((s) => new Set(s).add(id));
      setBusy(null);
      router.refresh();
    });
  }

  const pages = Math.max(1, Math.ceil(filtered / pageSize));
  const offset = (page - 1) * pageSize;
  const open = viewer ? submissions.find((s) => s.id === viewer.subId) : null;
  const openCount = open?.media.length ?? 0;

  return (
    <section>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">Queue</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular-nums">{filtered}</span> {status === "all" ? "shown" : status}
            <span className="mx-1.5 text-subtle">·</span>
            <span className="tabular-nums">{total}</span> total
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Segmented
            ariaLabel="Filter by status"
            items={TABS.map((t) => ({ key: t.value, label: t.label }))}
            active={status}
            onSelect={(k) => go({ status: k as Status, page: 1 })}
          />
          <div className="relative sm:w-72">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-hint" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60}
              aria-label="Search by username or country" placeholder="Search username or country"
              className="field h-10 py-0 pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden" />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:text-strong">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-muted sm:flex-row sm:items-start">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
        <div className="flex-1">
          <p className="font-medium text-ink">This page contains personal data. Never show it on stream or share screenshots.</p>
          <p className="mt-0.5">
            Before approving, check every photo for faces, children, names, addresses, documents, screens, reflections and location clues.
            If something slipped through, delete the submission. Email requests to delete data must be handled within one month.
          </p>
        </div>
        <button onClick={() => setShowEmails((v) => !v)}
          className="pressable flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-2.5 text-xs font-semibold text-muted hover:text-strong">
          {showEmails ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {showEmails ? "Hide emails" : "Show emails"}
        </button>
      </div>

      {error && (
        <p role="alert" className="enter-fade mt-6 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger-text" /> {error}
        </p>
      )}

      {submissions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <Inbox className="mx-auto size-8 text-subtle" />
          <h3 className="mt-3 text-base font-semibold text-strong">
            {q ? "No matches" : status === "pending" ? "You're all caught up" : "Nothing here yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {q ? `No submissions match "${q}". Try a different username or country.`
              : status === "pending" ? "New submissions will show up here for review."
              : "Approved submissions will appear here."}
          </p>
        </div>
      ) : (
        <ol className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,38rem),1fr))] items-start gap-4">
          {submissions.map((sub, index) => {
            const approved = sub.status === "approved";
            const isBusy = busy?.id === sub.id;
            const gone = leaving.has(sub.id);
            return (
              <li key={sub.id}
                className={`rounded-2xl border border-line bg-card p-4 shadow-raised transition-[opacity,transform] duration-200 ease-out sm:p-5 ${
                  gone ? "pointer-events-none scale-[0.98] opacity-0" : ""} ${isBusy ? "opacity-70" : ""}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-sm tabular-nums text-subtle">#{offset + index + 1}</span>
                      <h2 className="max-w-full truncate text-base font-semibold text-strong">@{sub.username}</h2>
                      <span className="text-sm text-muted">{sub.country}</span>
                      {status === "all" && (
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          approved ? "bg-success/15 text-success-text" : "bg-warning/15 text-warning-text"}`}>
                          {approved ? "Approved" : "Pending"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-subtle">
                      {showEmails ? (
                        <a href={`mailto:${sub.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all text-highlight/90 underline-offset-4 hover:underline">
                          <Mail className="size-3.5 shrink-0" /> {sub.email}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 shrink-0" /> {maskEmail(sub.email)}</span>
                      )}
                      <time dateTime={sub.submittedAt}>{formatDate(sub.submittedAt)}</time>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {approved ? (
                      <button disabled={isBusy} onClick={() => run(sub.id, "undo", unapproveSubmission, status === "approved")}
                        className="pressable flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-muted hover:border-line-strong hover:text-strong">
                        {isBusy && busy?.action === "undo" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                        Move to pending
                      </button>
                    ) : (
                      <button disabled={isBusy} onClick={() => run(sub.id, "approve", approveSubmission, status === "pending")}
                        className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-success px-3.5 text-[13px] font-semibold text-white shadow-raised hover:bg-success-hover">
                        {isBusy && busy?.action === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Approve
                      </button>
                    )}
                    <HoldButton
                      disabled={isBusy}
                      onConfirm={() => run(sub.id, "delete", deleteSubmission, true)}
                      label="Delete"
                      holdingLabel="Hold…"
                      icon={<Trash2 className="size-4" />}
                      className="flex h-9 items-center rounded-xl border border-danger/30 px-3 text-[13px] font-semibold text-danger-text hover:border-danger/60"
                      fillClassName="bg-danger text-white"
                    />
                  </div>
                </div>

                <p className="mt-4 max-w-[70ch] text-sm leading-relaxed whitespace-pre-line break-words text-ink/90">
                  {sub.description}
                </p>

                {sub.media.length > 0 && (
                  <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2" aria-label={`${sub.media.length} photos`}>
                    {sub.media.map((m, i) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => setViewer({ subId: sub.id, index: i })}
                          aria-label={`Open photo ${i + 1} of ${sub.media.length}`}
                          className="pressable block aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-black hover:border-accent/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm text-muted">
          <button disabled={page <= 1} onClick={() => go({ page: page - 1 })} aria-label="Previous page"
            className="pressable flex size-9 items-center justify-center rounded-xl border border-line hover:text-strong disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => go({ page: page + 1 })} aria-label="Next page"
            className="pressable flex size-9 items-center justify-center rounded-xl border border-line hover:text-strong disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}

      <Lightbox
        url={open && viewer ? open.media[viewer.index]?.url ?? null : null}
        caption={open && viewer ? `@${open.username} · ${viewer.index + 1} / ${openCount}` : undefined}
        onClose={() => setViewer(null)}
        onPrev={openCount > 1 ? () => setViewer((v) => v && { ...v, index: (v.index - 1 + openCount) % openCount }) : undefined}
        onNext={openCount > 1 ? () => setViewer((v) => v && { ...v, index: (v.index + 1) % openCount }) : undefined}
      />
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** j***@e***.com: suficiente para reconocerlo sin exponerlo si la pantalla sale en directo */
function maskEmail(email: string) {
  const [user, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const name = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}***@${name.slice(0, 1)}***${tld}`;
}
