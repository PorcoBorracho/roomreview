"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, ExternalLink, ShieldCheck, Tv, Pencil, LayoutGrid, Users, KeyRound, Link2, Check, Film, EyeOff, TriangleAlert } from "lucide-react";
import { revealBoardPassword, setBoardFlag } from "@/actions/boards";
import { boardHref, type BoardWithStats, type StreamerRef } from "@/lib/types";
import { useT } from "@/i18n/client";
import BoardDialog from "./BoardDialog";
import Switch from "./Switch";
import CopyButton from "./CopyButton";
import FormError from "./FormError";
import { Pill } from "./Pill";
import StreamerAvatar from "./StreamerAvatar";

type Viewer = { id: string; role: string; siteAdmin: boolean };

const accessBtn = "flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold whitespace-nowrap text-ink hover:border-line-strong";

/** streamers: para los que esta cuenta puede crear boards */
export default function Dashboard({ boards, streamers: allowed, viewer }: { boards: BoardWithStats[]; streamers: StreamerRef[]; viewer: Viewer }) {
  const t = useT();
  const router = useRouter();
  // Se guarda el id (no una copia): al refrescar, el diálogo recibe los datos nuevos del board
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, { isActive: boolean; submissionsOpen: boolean }>>({});
  const [origin, setOrigin] = useState("");
  const [streamerFilter, setStreamerFilter] = useState("");
  const [, startTransition] = useTransition();
  const isStreamer = viewer.role === "streamer";
  // Streamers que aparecen en los boards, para el filtro
  const streamers = [...new Map(boards.flatMap((b) => (b.streamer ? [[b.streamer.id, b.streamer] as const] : []))).values()]
    .sort((x, y) => x.displayName.localeCompare(y.displayName));
  const editing = editingId ? boards.find((b) => b.id === editingId) ?? null : null;
  const canDelete = (b: BoardWithStats) => viewer.siteAdmin || b.ownerId === viewer.id || (isStreamer && b.streamer?.id === viewer.id);
  const canShare = (b: BoardWithStats) => viewer.siteAdmin || b.ownerId === viewer.id;
  const canCreate = allowed.length > 0;

  useEffect(() => setOrigin(window.location.origin), []);
  // Cuando llegan datos nuevos del servidor, descartamos el estado optimista
  useEffect(() => { setFlags({}); }, [boards]);
  // Si el board que se editaba ya no existe (lo borró otra persona), se cierra el diálogo
  useEffect(() => { if (editingId && !editing) setDialogOpen(false); }, [editingId, editing]);

  function openCreate() { setEditingId(null); setDialogOpen(true); }
  function openEdit(b: BoardWithStats) { setEditingId(b.id); setDialogOpen(true); }

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

  async function copyPassword(b: BoardWithStats, kind: "streamer" | "moderator") {
    const res = await revealBoardPassword(b.id, kind);
    if (!res.ok) { setError(res.error); return null; }
    return res.password;
  }

  const visible = boards.filter((b) => !streamerFilter || (streamerFilter === "none" ? !b.streamer : b.streamer?.id === streamerFilter));
  const totalPending = boards.reduce((n, b) => n + b.pending, 0);

  return (
    <section>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.dashboard.title}</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">{t.dashboard.summary(boards.length, totalPending)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!isStreamer && (streamers.length > 1 || boards.some((b) => !b.streamer)) && (
            <select value={streamerFilter} onChange={(e) => setStreamerFilter(e.target.value)} aria-label={t.dashboard.filterStreamer}
              className="field h-10 py-0 sm:w-56">
              <option value="">{t.dashboard.allStreamers}</option>
              {streamers.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
              {boards.some((b) => !b.streamer) && <option value="none">{t.status.noStreamer}</option>}
            </select>
          )}
          {isStreamer && allowed[0] && (
            <Link href={`/${allowed[0].login}`} target="_blank"
              className="pressable flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:border-line-strong">
              <ExternalLink className="size-4 text-subtle" /> {t.dashboard.myPage}
            </Link>
          )}
          <button onClick={openCreate} disabled={!canCreate} title={canCreate ? undefined : t.dashboard.noStreamersHint}
            className="pressable flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/45">
            <Plus className="size-4" /> {t.dashboard.newBoard}
          </button>
        </div>
      </header>

      {!canCreate && !isStreamer && (
        <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" /> {t.dashboard.noStreamersHint}
        </p>
      )}

      {error && (
        <div role="alert" className="enter-fade mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
          <FormError code={error} className="flex-1" />
          <button onClick={() => setError(null)} className="text-xs font-semibold text-danger-text underline">{t.common.dismiss}</button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <LayoutGrid className="mx-auto size-8 text-subtle" />
          <h2 className="mt-3 text-base font-semibold text-strong">{t.dashboard.emptyTitle}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted">{isStreamer ? t.dashboard.emptyTextStreamer : t.dashboard.emptyText}</p>
          {!viewer.siteAdmin && !isStreamer && <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-subtle">{t.dashboard.emptyShared}</p>}
          {canCreate && (
            <button onClick={openCreate}
              className="pressable mx-auto mt-5 flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              <Plus className="size-4" /> {t.dashboard.newBoard}
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,30rem),1fr))] gap-5">
          {visible.map((b) => {
            const f = flags[b.id] ?? { isActive: b.isActive, submissionsOpen: b.submissionsOpen };
            const href = boardHref(b);
            const publicUrl = href ? `${origin}${href}` : "";
            const mine = b.ownerId === viewer.id;
            const shared = !mine && b.members.some((m) => m.id === viewer.id);
            const ownership = isStreamer
              ? (mine ? t.dashboard.createdByYou : b.ownerName ? t.dashboard.createdBy(b.ownerName) : null)
              : mine ? t.dashboard.ownedByYou : shared ? t.dashboard.sharedWithYou : b.ownerName ? t.dashboard.ownedBy(b.ownerName) : t.dashboard.noOwner;
            return (
              <li key={b.id} className="flex flex-col rounded-2xl border border-line bg-card shadow-raised">
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-base leading-snug font-semibold text-strong">{b.title}</h2>
                    {!f.isActive ? <Pill tone="muted">{t.status.inactive}</Pill>
                      : f.submissionsOpen ? <Pill tone="success">{t.status.open}</Pill>
                      : <Pill tone="warning">{t.status.closed}</Pill>}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
                    {b.streamer ? (
                      !isStreamer && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <StreamerAvatar streamer={b.streamer} size="sm" />
                          <span className="truncate">{b.streamer.displayName}</span>
                          {b.streamer.status !== "active" && <Pill tone="warning">{t.streamers.status[b.streamer.status]}</Pill>}
                        </span>
                      )
                    ) : (
                      <span className="text-warning-text">{t.status.noStreamer}</span>
                    )}
                    {b.peopleAllowed && <span className="inline-flex items-center gap-1 text-accent-text"><Users className="size-3.5" /> {t.status.peopleAllowed}</span>}
                    {b.allowVideos && <span className="inline-flex items-center gap-1 text-accent-text"><Film className="size-3.5" /> {t.status.videos}</span>}
                    {!b.blurNew && <span className="inline-flex items-center gap-1 text-subtle"><EyeOff className="size-3.5" /> {t.status.noBlur}</span>}
                  </p>

                  {href ? (
                    <div className="mt-3 flex min-w-0 items-center gap-1 text-[13px]">
                      <Link href={href} className="min-w-0 truncate text-accent-text underline-offset-4 hover:underline">
                        {publicUrl.replace(/^https?:\/\//, "") || href}
                      </Link>
                      <IconCopy text={publicUrl} label={t.dashboard.copyPublicLink} />
                      <a href={href} target="_blank" rel="noreferrer" aria-label={t.common.openInNewTab} title={t.common.openInNewTab}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-raised hover:text-strong">
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-warning-text">{t.dashboard.assignStreamer}</p>
                  )}

                  {b.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{b.description}</p>}

                  <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-subtle">
                    {href && !isStreamer
                      ? <Link href={`${href}/queue`} className="font-semibold text-ink tabular-nums hover:underline">{t.dashboard.pending(b.pending)}</Link>
                      : <span className="font-semibold text-ink tabular-nums">{t.dashboard.pending(b.pending)}</span>}
                    <span>·</span>
                    <span className="tabular-nums">{t.dashboard.approved(b.approved)}</span>
                    {ownership && <><span>·</span><span>{ownership}</span></>}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line px-5 py-3.5">
                  <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                    <Switch label={`${b.title}: ${t.dashboard.active}`} checked={f.isActive} onChange={(v) => toggle(b, "isActive", v)} />
                    {t.dashboard.active}
                  </label>
                  <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                    <Switch label={`${b.title}: ${t.dashboard.accepting}`} checked={f.submissionsOpen} onChange={(v) => toggle(b, "submissionsOpen", v)} />
                    {t.dashboard.accepting}
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
                  {href && !isStreamer && (
                    <Link href={`${href}/queue`} prefetch={false}
                      className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-semibold text-ink hover:bg-line">
                      <ShieldCheck className="size-4" /> {t.board.queue}
                    </Link>
                  )}
                  {href && (
                    <Link href={`${href}/deck`} prefetch={false}
                      className="pressable flex h-9 items-center gap-1.5 rounded-xl bg-raised px-3 text-[13px] font-semibold text-ink hover:bg-line">
                      <Tv className="size-4" /> {t.board.deck}
                    </Link>
                  )}
                  <button onClick={() => openEdit(b)}
                    className="pressable flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
                    <Pencil className="size-4" /> {t.dashboard.edit}
                  </button>
                </div>

                {/* Accesos: misma retícula en las dos filas (nombre | botones), así quedan alineadas y nunca se parten distinto */}
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] divide-y divide-line rounded-b-2xl border-t border-line bg-panel">
                  {([
                    ["moderator", t.dashboard.moderatorAccess, t.dashboard.queueLink, `${publicUrl}/queue`, b.hasModeratorPassword],
                    ["streamer", t.dashboard.streamerAccess, t.dashboard.deckLink, `${publicUrl}/deck`, b.hasStreamerPassword],
                  ] as const).map(([kind, label, linkLabel, url, has]) => (
                    <div key={kind} className="col-span-2 grid grid-cols-subgrid items-center gap-x-4 px-5 py-3">
                      <dt className="truncate text-[13px] font-medium text-subtle">{label}</dt>
                      <dd className="flex justify-end gap-2">
                        {has ? (
                          <>
                            {href && <CopyButton label={t.dashboard.link} ariaLabel={linkLabel} icon={Link2} getText={() => url} className={accessBtn} />}
                            <CopyButton label={t.dashboard.password} ariaLabel={`${label}: ${t.dashboard.password}`} icon={KeyRound}
                              getText={() => copyPassword(b, kind)} onError={setError} className={accessBtn} />
                          </>
                        ) : (
                          <button onClick={() => openEdit(b)}
                            className="pressable flex h-8 items-center gap-1.5 rounded-lg border border-warning/40 px-2.5 text-[13px] font-semibold whitespace-nowrap text-warning-text hover:border-warning/70">
                            <KeyRound className="size-4" /> {t.dashboard.setUp}
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <BoardDialog
        board={editing}
        canDelete={editing ? canDelete(editing) : true}
        canShare={editing ? canShare(editing) : false}
        streamers={allowed}
        viewerRole={viewer.role}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); router.refresh(); }}
        onDeleted={() => { setDialogOpen(false); setEditingId(null); router.refresh(); }}
        onChanged={() => router.refresh()}
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
