"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, ExternalLink, ShieldCheck, Tv, Pencil, LayoutGrid, AlertCircle, Users, KeyRound, Link2, Check } from "lucide-react";
import { revealBoardPassword, setBoardFlag } from "@/actions/boards";
import { platformLabel } from "@/lib/platforms";
import type { Board, BoardWithStats } from "@/lib/types";
import BoardDialog from "./BoardDialog";
import Switch from "./Switch";
import CopyButton from "./CopyButton";
import { Pill } from "./Pill";

export default function Dashboard({ boards }: { boards: BoardWithStats[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BoardWithStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, { isActive: boolean; submissionsOpen: boolean }>>({});
  const [origin, setOrigin] = useState("");
  const [streamerFilter, setStreamerFilter] = useState("");
  const [, startTransition] = useTransition();
  const streamers = [...new Set(boards.map((b) => b.streamerName).filter(Boolean))].sort((x, y) => x.localeCompare(y));

  useEffect(() => setOrigin(window.location.origin), []);
  // Cuando llegan datos nuevos del servidor, descartamos el estado optimista
  useEffect(() => { setFlags({}); }, [boards]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(b: BoardWithStats) { setEditing(b); setDialogOpen(true); }

  function toggle(b: BoardWithStats, flag: "isActive" | "submissionsOpen", value: boolean) {
    setError(null);
    const current = flags[b.id] ?? { isActive: b.isActive, submissionsOpen: b.submissionsOpen };
    setFlags((f) => ({ ...f, [b.id]: { ...current, [flag]: value } })); // optimista
    startTransition(async () => {
      const res = await setBoardFlag(b.id, flag, value);
      if (!res.ok) {
        setError(res.error);
        setFlags((f) => ({ ...f, [b.id]: current }));
      }
      router.refresh();
    });
  }

  async function copyPassword(b: Board) {
    const res = await revealBoardPassword(b.id);
    if (!res.ok) { setError(res.error); return null; }
    return res.password;
  }

  const visible = boards.filter((b) => !streamerFilter || b.streamerName === streamerFilter);
  const totalPending = boards.reduce((n, b) => n + b.pending, 0);

  return (
    <section>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">Boards</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular-nums">{boards.length}</span> {boards.length === 1 ? "board" : "boards"}
            <span className="mx-1.5 text-subtle">·</span>
            <span className="tabular-nums">{totalPending}</span> pending review
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {streamers.length > 1 && (
            <select value={streamerFilter} onChange={(e) => setStreamerFilter(e.target.value)} aria-label="Filter by streamer"
              className="field h-10 py-0 sm:w-56">
              <option value="">All streamers</option>
              {streamers.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <button onClick={openCreate}
            className="pressable flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover">
            <Plus className="size-4" /> New board
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="enter-fade mt-6 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
        </p>
      )}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <LayoutGrid className="mx-auto size-8 text-subtle" />
          <h2 className="mt-3 text-base font-semibold text-strong">No boards yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Create a board, then share its public link with your community and the deck link and password with the streamer.</p>
          <button onClick={openCreate}
            className="pressable mx-auto mt-5 flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <Plus className="size-4" /> New board
          </button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-4">
          {visible.map((b) => {
            const f = flags[b.id] ?? { isActive: b.isActive, submissionsOpen: b.submissionsOpen };
            const publicUrl = `${origin}/${b.slug}`;
            const deckUrl = `${origin}/${b.slug}/deck`;
            return (
              <li key={b.id} className="flex flex-col rounded-2xl border border-line bg-card shadow-raised">
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-base leading-snug font-semibold text-strong">{b.title}</h2>
                    {!f.isActive ? <Pill tone="muted">Inactive</Pill>
                      : f.submissionsOpen ? <Pill tone="success">Open</Pill>
                      : <Pill tone="warning">Closed</Pill>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                    {b.streamerName
                      ? <span>{b.streamerName} · {platformLabel(b.platform)}</span>
                      : <span className="text-warning-text">No streamer set</span>}
                    {b.peopleAllowed && <span className="inline-flex items-center gap-1 text-accent-text"><Users className="size-3.5" /> People allowed</span>}
                  </p>

                  <div className="mt-3 flex min-w-0 items-center gap-1 text-[13px]">
                    <Link href={`/${b.slug}`} className="min-w-0 truncate text-accent-text underline-offset-4 hover:underline">
                      {publicUrl.replace(/^https?:\/\//, "") || `/${b.slug}`}
                    </Link>
                    <IconCopy text={publicUrl} label="Copy public link" />
                    <a href={`/${b.slug}`} target="_blank" rel="noreferrer" aria-label="Open public page in new tab" title="Open in new tab"
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-raised hover:text-strong">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  {b.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{b.description}</p>}

                  <p className="mt-3 text-[13px] text-subtle">
                    <Link href={`/${b.slug}/queue`} className="font-semibold text-ink tabular-nums hover:underline">{b.pending} pending</Link>
                    <span className="mx-1.5">·</span>
                    <span className="tabular-nums">{b.approved} approved</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line px-5 py-3.5">
                  <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                    <Switch label={`${b.title}: active`} checked={f.isActive} onChange={(v) => toggle(b, "isActive", v)} />
                    Active
                  </label>
                  <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                    <Switch label={`${b.title}: accepting submissions`} checked={f.submissionsOpen} onChange={(v) => toggle(b, "submissionsOpen", v)} />
                    Accepting submissions
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
                  <Link href={`/${b.slug}/queue`} prefetch={false}
                    className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-semibold text-ink hover:bg-line">
                    <ShieldCheck className="size-4" /> Queue
                  </Link>
                  <Link href={`/${b.slug}/deck`} prefetch={false}
                    className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-semibold text-ink hover:bg-line">
                    <Tv className="size-4" /> Deck
                  </Link>
                  <button onClick={() => openEdit(b)}
                    className="pressable flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
                    <Pencil className="size-4" /> Edit
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-line bg-panel px-5 py-3.5">
                  <span className="w-full text-[13px] font-medium text-subtle min-[420px]:mr-auto min-[420px]:w-auto">Streamer access</span>
                  {b.hasStreamerPassword ? (
                    <>
                      <CopyButton label="Deck link" icon={Link2} getText={() => deckUrl}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong" />
                      <CopyButton label="Password" icon={KeyRound} getText={() => copyPassword(b)} onError={setError}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong" />
                    </>
                  ) : (
                    <button onClick={() => openEdit(b)}
                      className="pressable flex h-8 items-center gap-1.5 rounded-lg border border-warning/40 px-2.5 text-[13px] font-semibold text-warning-text hover:border-warning/70">
                      <KeyRound className="size-4" /> Set password
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BoardDialog
        board={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); router.refresh(); }}
        onDeleted={() => { setDialogOpen(false); router.refresh(); }}
        knownStreamers={streamers}
      />
    </section>
  );
}

function IconCopy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label={label} title={label}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
      className="pressable flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-raised hover:text-strong">
      {copied ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
    </button>
  );
}
