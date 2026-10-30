"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Info, KeyRound, RefreshCw, Trash2, Copy, UserPlus, Crown, CheckCircle2 } from "lucide-react";
import {
  createBoard, deleteBoard, regenerateBoardPassword, revealBoardPassword, shareBoard, unshareBoard, updateBoard,
} from "@/actions/boards";
import { generatePassword } from "@/lib/password-gen";
import { slugify, slugProblem } from "@/lib/slug";
import type { Board, StreamerRef } from "@/lib/types";
import { useT } from "@/i18n/client";
import { errorText } from "@/i18n/dict";
import CopyButton from "./CopyButton";
import HoldButton from "./HoldButton";
import Switch from "./Switch";
import FormError from "./FormError";
import StreamerAvatar from "./StreamerAvatar";

type Kind = "streamer" | "moderator";

type Props = {
  /** null = crear; un board = editar */
  board: (Board & { pending?: number; approved?: number }) | null;
  /** Quien lo creó, su streamer o un Site Admin */
  canDelete: boolean;
  /** Quien lo creó o un Site Admin */
  canShare: boolean;
  /** Streamers para los que esta cuenta puede crear boards (o a los que puede pasar uno) */
  streamers: StreamerRef[];
  viewerRole: string;
  open: boolean;
  onClose: () => void;
  onSaved: (slug: string) => void;
  onDeleted?: () => void;
  /** Cambios que no cierran el diálogo (compartir, regenerar): refrescan los datos de fondo */
  onChanged?: () => void;
};

const smallBtn = "flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong";

export default function BoardDialog({ board, canDelete, canShare, streamers, viewerRole, open, onClose, onSaved, onDeleted, onChanged }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const isStreamer = viewerRole === "streamer";
  const [streamerId, setStreamerId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [peopleAllowed, setPeopleAllowed] = useState(false);
  const [blurNew, setBlurNew] = useState(true);
  const [allowVideos, setAllowVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [passwords, setPasswords] = useState<Record<Kind, string>>({ streamer: "", moderator: "" });
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setStreamerId(board?.streamer?.id ?? (streamers.length === 1 ? streamers[0].id : ""));
      setTitle(board?.title ?? "");
      setSlug(board?.slug ?? "");
      setSlugTouched(!!board);
      setDescription(board?.description ?? "");
      setIsActive(board?.isActive ?? true);
      setSubmissionsOpen(board?.submissionsOpen ?? true);
      setPeopleAllowed(board?.peopleAllowed ?? false);
      setBlurNew(board?.blurNew ?? true);
      setAllowVideos(board?.allowVideos ?? false);
      setMembers(board?.members ?? []);
      setError(null);
      setPasswords(board ? { streamer: "", moderator: "" } : { streamer: generatePassword(), moderator: generatePassword() });
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
    // Solo al abrir: los datos que llegan después (router.refresh) no deben pisar lo que se está editando
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board?.id]);

  // El streamer actual del board aunque esta cuenta no pueda elegirlo (p. ej. un board compartido)
  const options = board?.streamer && !streamers.some((x) => x.id === board.streamer!.id) ? [board.streamer, ...streamers] : streamers;
  const selected = options.find((x) => x.id === streamerId) ?? null;
  const slugIssue = slug ? slugProblem(slug) : null;
  const slugError = slugIssue ? errorText(t, slugIssue === "reserved" ? "slugReserved" : "slugInvalid") : null;
  const slugChanged = !!board && slug !== board.slug;
  const pwShort = (k: Kind) => !board && passwords[k].trim().length > 0 && passwords[k].trim().length < 10;
  const pwSame = !board && passwords.streamer.length > 0 && passwords.streamer === passwords.moderator;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (slugIssue) return setError(slugIssue === "reserved" ? "slugReserved" : "slugInvalid");
    setSaving(true);
    const input = { streamerId, title, slug, description, isActive, submissionsOpen, peopleAllowed, blurNew, allowVideos };
    const res = board
      ? await updateBoard(board.id, input, board.updatedAt)
      : await createBoard({ ...input, streamerPassword: passwords.streamer, moderatorPassword: passwords.moderator });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved(res.slug);
  }

  async function remove() {
    if (!board) return;
    setDeleting(true);
    setError(null);
    const res = await deleteBoard(board.id);
    setDeleting(false);
    if (!res.ok) return setError(res.error);
    onDeleted?.();
  }

  const total = (board?.pending ?? 0) + (board?.approved ?? 0);

  return (
    <dialog ref={ref} aria-labelledby="board-dialog-title"
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      className="review-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-float">
      {open && (
        <form onSubmit={save} className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <h3 id="board-dialog-title" className="text-lg font-semibold text-strong">{board ? t.boardDialog.editTitle : t.boardDialog.newTitle}</h3>
            <button type="button" onClick={onClose} disabled={saving} aria-label={t.common.close}
              className="pressable -m-1 rounded-lg p-1.5 text-subtle hover:text-strong"><X className="size-5" /></button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {!isStreamer && (
              <div>
                <label htmlFor="b-streamer" className="mb-2 block text-sm font-medium text-ink">{t.boardDialog.streamer}</label>
                <div className="flex items-center gap-2.5">
                  {selected && <StreamerAvatar streamer={selected} />}
                  <select id="b-streamer" required value={streamerId} onChange={(e) => setStreamerId(e.target.value)} className="field" autoFocus>
                    {!streamerId && <option value="">{t.boardDialog.chooseStreamer}</option>}
                    {options.map((x) => <option key={x.id} value={x.id}>{x.displayName} (@{x.login})</option>)}
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-subtle">{t.boardDialog.streamerHint}</p>
              </div>
            )}

            <div>
              <label htmlFor="b-title" className="mb-2 block text-sm font-medium text-ink">{t.boardDialog.title}</label>
              <input id="b-title" required maxLength={80} value={title} placeholder={t.boardDialog.titlePlaceholder} autoFocus={isStreamer}
                onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
                className="field" />
            </div>

            <div>
              <label htmlFor="b-slug" className="mb-2 block text-sm font-medium text-ink">{t.boardDialog.address}</label>
              <div className={`flex items-center overflow-hidden rounded-xl border bg-well focus-within:border-accent ${slugError ? "border-danger" : "border-line"}`}>
                <span className="max-w-[55%] shrink-0 truncate border-r border-line px-3 py-2.5 text-sm text-subtle" dir="rtl">
                  <bdi>{origin.replace(/^https?:\/\//, "")}/{selected?.login ?? "…"}/</bdi>
                </span>
                <input id="b-slug" required maxLength={48} value={slug} spellCheck={false} autoCapitalize="off" placeholder="pet-review"
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                  aria-invalid={slugError ? true : undefined} aria-describedby="b-slug-help"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-ink outline-none sm:text-sm" />
              </div>
              <p id="b-slug-help" className={`mt-1.5 text-xs ${slugError ? "text-danger-text" : "text-subtle"}`}>
                {slugError ?? t.boardDialog.addressHint}
              </p>
              {slugChanged && !slugError && <p className="mt-1.5 text-xs text-warning-text">{t.boardDialog.addressChanged}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="b-desc" className="text-sm font-medium text-ink">{t.boardDialog.description}</label>
                <span className="text-xs tabular-nums text-subtle">{description.length}/1000</span>
              </div>
              <textarea id="b-desc" rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t.boardDialog.descriptionPlaceholder} className="field min-h-24 resize-y" />
              <p className="mt-1.5 text-xs text-subtle">{t.boardDialog.descriptionHint}</p>
            </div>

            <div className="divide-y divide-line rounded-xl border border-line">
              <Toggle id="b-active" label={t.boardDialog.activeLabel} checked={isActive} onChange={setIsActive} hint={t.boardDialog.activeHint} />
              <Toggle id="b-open" label={t.boardDialog.acceptingLabel} checked={submissionsOpen} onChange={setSubmissionsOpen} hint={t.boardDialog.acceptingHint} />
              <Toggle id="b-people" label={t.boardDialog.peopleLabel} checked={peopleAllowed} onChange={setPeopleAllowed} hint={t.boardDialog.peopleHint} />
              <Toggle id="b-blur" label={t.boardDialog.blurLabel} checked={blurNew} onChange={setBlurNew} hint={t.boardDialog.blurHint} />
              <Toggle id="b-videos" label={t.boardDialog.videosLabel} checked={allowVideos} onChange={setAllowVideos} hint={t.boardDialog.videosHint} />
            </div>

            {peopleAllowed && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-warning-text" /> {t.boardDialog.peopleWarning}
              </p>
            )}

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-strong">{t.boardDialog.passwords}</legend>
              {board ? (
                <>
                  <PasswordRow board={board} kind="streamer" has={board.hasStreamerPassword} onError={setError} onChanged={onChanged} />
                  <PasswordRow board={board} kind="moderator" has={board.hasModeratorPassword} onError={setError} onChanged={onChanged} />
                </>
              ) : (
                <>
                  {(["streamer", "moderator"] as const).map((k) => (
                    <div key={k}>
                      <label htmlFor={`b-pw-${k}`} className="block text-sm font-medium text-ink">
                        {k === "streamer" ? t.boardDialog.streamerPassword : t.boardDialog.moderatorPassword}
                      </label>
                      <p className="mt-0.5 mb-2 text-xs text-subtle">{k === "streamer" ? t.boardDialog.streamerPasswordHint : t.boardDialog.moderatorPasswordHint}</p>
                      <div className="flex gap-2">
                        <input id={`b-pw-${k}`} required minLength={10} maxLength={128} value={passwords[k]} spellCheck={false} autoComplete="off"
                          onChange={(e) => setPasswords((p) => ({ ...p, [k]: e.target.value }))}
                          aria-invalid={pwShort(k) || (k === "moderator" && pwSame) ? true : undefined}
                          className="field min-w-0 flex-1 font-mono" />
                        <button type="button" onClick={() => setPasswords((p) => ({ ...p, [k]: generatePassword() }))} title={t.common.generate}
                          className="pressable flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-muted hover:border-line-strong hover:text-strong">
                          <RefreshCw className="size-4" /> <span className="hidden sm:inline">{t.common.generate}</span>
                        </button>
                      </div>
                      {pwShort(k) && <p className="mt-1.5 text-xs text-danger-text">{t.boardDialog.passwordMin}</p>}
                      {k === "moderator" && pwSame && <p className="mt-1.5 text-xs text-danger-text">{t.errors.passwordSameAsAdmin}</p>}
                    </div>
                  ))}
                  <p className="text-xs leading-relaxed text-subtle">{t.boardDialog.passwordCreateHint}</p>
                </>
              )}
            </fieldset>

            {board && !isStreamer && (
              <Sharing board={board} canOwn={canShare} members={members} setMembers={setMembers} onError={setError} onChanged={onChanged} />
            )}

            {board && (
              <div className="rounded-xl border border-danger/30 p-4">
                <p className="text-sm font-medium text-ink">{t.boardDialog.deleteTitle}</p>
                {canDelete ? (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-subtle">{t.boardDialog.deleteText(total)}</p>
                    <HoldButton holdMs={1500} disabled={deleting || saving} onConfirm={remove}
                      label={t.boardDialog.deleteButton} holdingLabel={t.common.keepHolding} icon={<Trash2 className="size-4" />}
                      className="mt-3 flex h-9 items-center rounded-xl border border-danger/40 px-3 text-[13px] font-semibold text-danger-text hover:border-danger/70"
                      fillClassName="bg-danger text-white" />
                  </>
                ) : (
                  <p className="mt-0.5 text-xs leading-relaxed text-subtle">{t.boardDialog.deleteOwnerOnly}</p>
                )}
              </div>
            )}
          </div>

          <footer className="space-y-3 border-t border-line bg-panel px-5 py-4 sm:px-6">
            {error && (
              <div className="enter-fade rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
                <FormError code={error} />
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={saving}
                className="pressable flex h-11 shrink-0 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-muted hover:border-line-strong hover:text-strong">
                {t.common.cancel}
              </button>
              <button type="submit"
                disabled={saving || deleting || !!slugError || pwShort("streamer") || pwShort("moderator") || pwSame || !title.trim() || (!isStreamer && !streamerId)}
                className="pressable flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/45">
                {saving && <Loader2 className="size-4 animate-spin" />} {board ? t.boardDialog.saveChanges : t.boardDialog.create}
              </button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
  );
}

/** Una contraseña de un board existente: copiar y regenerar (mantener pulsado, porque expulsa a quien la usa). */
function PasswordRow({ board, kind, has, onError, onChanged }: {
  board: Board; kind: Kind; has: boolean; onError: (e: string | null) => void; onChanged?: () => void;
}) {
  const t = useT();
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(has);
  useEffect(() => setExists(has), [has]);

  async function regenerate() {
    onError(null);
    setBusy(true);
    const r = await regenerateBoardPassword(board.id, kind);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    setFresh(r.password);
    setExists(true);
    onChanged?.();
  }

  const label = kind === "streamer" ? t.boardDialog.streamerPassword : t.boardDialog.moderatorPassword;
  const hint = kind === "streamer" ? t.boardDialog.streamerPasswordHint : t.boardDialog.moderatorPasswordHint;

  return (
    <div className="rounded-xl border border-line bg-well px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <KeyRound className={`size-4 ${exists ? "text-accent-text" : "text-warning-text"}`} /> {label}
          </p>
          <p className="mt-0.5 text-xs text-subtle">{exists ? hint : t.dashboard.noPassword}</p>
        </div>
        <div className="flex items-center gap-2">
          {exists && (
            <CopyButton label={t.common.copy} icon={Copy} onError={onError} className={smallBtn}
              getText={async () => { const r = await revealBoardPassword(board.id, kind); if (!r.ok) { onError(r.error); return null; } return r.password; }} />
          )}
          {exists ? (
            <HoldButton holdMs={900} disabled={busy} onConfirm={regenerate}
              label={t.boardDialog.regenerate} holdingLabel={t.common.keepHolding} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              className="flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong"
              fillClassName="bg-accent text-on-accent" />
          ) : (
            <button type="button" onClick={regenerate} disabled={busy}
              className="pressable flex h-8 items-center gap-1.5 rounded-lg border border-warning/40 px-2.5 text-[13px] font-semibold text-warning-text hover:border-warning/70">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} {t.boardDialog.generateNow}
            </button>
          )}
        </div>
      </div>
      {fresh && (
        <div className="enter-fade mt-3 border-t border-line pt-3">
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-success-text">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> {t.boardDialog.regenerated}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2.5 py-1.5 font-mono text-[13px] text-strong">{fresh}</code>
            <CopyButton label={t.common.copy} icon={Copy} getText={() => fresh} onError={onError} className={smallBtn} />
          </div>
        </div>
      )}
    </div>
  );
}

function Sharing({ board, canOwn, members, setMembers, onError, onChanged }: {
  board: Board; canOwn: boolean; members: { id: string; username: string }[];
  setMembers: (m: { id: string; username: string }[]) => void; onError: (e: string | null) => void; onChanged?: () => void;
}) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const u = username.trim();
    if (!u) return;
    onError(null);
    setBusy(true);
    const r = await shareBoard(board.id, u);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    setMembers([...members, r.member].sort((a, b) => a.username.localeCompare(b.username)));
    setUsername("");
    onChanged?.();
  }

  async function remove(id: string) {
    onError(null);
    const before = members;
    setMembers(members.filter((m) => m.id !== id)); // optimista
    const r = await unshareBoard(board.id, id);
    if (!r.ok) { setMembers(before); return onError(r.error); }
    onChanged?.();
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-strong">{t.boardDialog.sharing}</legend>
      <p className="mt-0.5 text-xs leading-relaxed text-subtle">{t.boardDialog.sharingHint}</p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
        <li className="flex items-center gap-2 px-3.5 py-2.5 text-sm">
          <Crown className="size-4 text-accent-text" />
          <span className="font-medium text-ink">{board.ownerName ? t.boardDialog.owner(board.ownerName) : t.dashboard.noOwner}</span>
        </li>
        {members.length === 0 && <li className="px-3.5 py-2.5 text-sm text-subtle">{t.boardDialog.notShared}</li>}
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 px-3.5 py-2 text-sm">
            <span className="min-w-0 truncate text-ink">{m.username}</span>
            {canOwn && (
              <button type="button" onClick={() => remove(m.id)} aria-label={t.boardDialog.unshare(m.username)} title={t.boardDialog.unshare(m.username)}
                className="pressable flex size-8 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-danger-text">
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canOwn ? (
        <div className="mt-3 flex gap-2">
          <label htmlFor="b-share" className="sr-only">{t.boardDialog.shareUsername}</label>
          <input id="b-share" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.boardDialog.shareUsername}
            autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={32}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
            className="field min-w-0 flex-1" />
          <button type="button" onClick={add} disabled={busy || !username.trim()}
            className="pressable flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} {t.boardDialog.share}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-subtle">{t.boardDialog.ownerOnly}</p>
      )}
    </fieldset>
  );
}

function Toggle({ id, label, hint, checked, onChange }: {
  id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <p className="mt-0.5 text-xs leading-relaxed text-subtle">{hint}</p>
      </div>
      <Switch id={id} label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
