"use client";

import { useEffect, useRef, useState } from "react";
import { X, AlertCircle, Loader2, Info, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { createBoard, deleteBoard, revealBoardPassword, setMissingBoardPassword, updateBoard } from "@/actions/boards";
import { generatePassword } from "@/lib/password-gen";
import CopyButton from "./CopyButton";
import HoldButton from "./HoldButton";
import { slugify, slugProblem } from "@/lib/slug";
import { PLATFORM_KEYS, platformLabel, type Platform } from "@/lib/platforms";
import type { Board } from "@/lib/types";
import Switch from "./Switch";

type Props = {
  /** null = crear; un board = editar */
  board: (Board & { pending?: number; approved?: number }) | null;
  open: boolean;
  onClose: () => void;
  onSaved: (slug: string) => void;
  onDeleted?: () => void;
  /** Streamers ya usados, para autocompletar */
  knownStreamers?: string[];
};

export default function BoardDialog({ board, open, onClose, onSaved, onDeleted, knownStreamers = [] }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [streamerName, setStreamerName] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitch");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [peopleAllowed, setPeopleAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setStreamerName(board?.streamerName ?? "");
      setPlatform(board?.platform ?? "twitch");
      setTitle(board?.title ?? "");
      setSlug(board?.slug ?? "");
      setSlugTouched(!!board);
      setDescription(board?.description ?? "");
      setIsActive(board?.isActive ?? true);
      setSubmissionsOpen(board?.submissionsOpen ?? true);
      setPeopleAllowed(board?.peopleAllowed ?? false);
      setError(null);
      setPassword(board ? "" : generatePassword());
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [open, board]);

  const slugError = slug ? slugProblem(slug) : null;
  const slugChanged = !!board && slug !== board.slug;
  const needsPassword = !board || !board.hasStreamerPassword;
  const passwordError = needsPassword && password && password.trim().length < 10 ? "Use at least 10 characters." : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (slugError) return setError(`Address: ${slugError}`);
    if (needsPassword && (!password || passwordError)) return setError(`Streamer password: ${passwordError ?? "required"}`);
    setSaving(true);
    const input = { streamerName, platform, title, slug, description, isActive, submissionsOpen, peopleAllowed };
    if (board) {
      const res = await updateBoard(board.id, input, board.updatedAt);
      if (!res.ok) { setSaving(false); return setError(res.error); }
      if (needsPassword) {
        const pw = await setMissingBoardPassword(board.id, password);
        if (!pw.ok) { setSaving(false); return setError(pw.error); }
      }
      setSaving(false);
      onSaved(res.slug);
    } else {
      const res = await createBoard({ ...input, streamerPassword: password });
      setSaving(false);
      if (!res.ok) return setError(res.error);
      onSaved(res.slug);
    }
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

  return (
    <dialog ref={ref} aria-labelledby="board-dialog-title"
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      className="review-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-float">
      {open && (
        <form onSubmit={save} className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <h3 id="board-dialog-title" className="text-lg font-semibold text-white">{board ? "Edit board" : "New board"}</h3>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close"
              className="pressable -m-1 rounded-lg p-1.5 text-subtle hover:text-white"><X className="size-5" /></button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <div>
                <label htmlFor="b-streamer" className="mb-2 block text-sm font-medium text-ink">Streamer</label>
                <input id="b-streamer" required maxLength={40} value={streamerName} autoFocus placeholder="Channel name"
                  list="known-streamers" autoComplete="off" spellCheck={false}
                  onChange={(e) => { setStreamerName(e.target.value); if (!slugTouched) setSlug(slugify(`${e.target.value} ${title}`)); }}
                  className="field" />
                <datalist id="known-streamers">
                  {knownStreamers.map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="b-platform" className="mb-2 block text-sm font-medium text-ink">Streams on</label>
                <select id="b-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="field">
                  {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{platformLabel(k)}</option>)}
                </select>
              </div>
            </div>
            <p className="-mt-3 text-xs text-subtle">Shown on the public page and in the consent senders agree to.</p>

            <div>
              <label htmlFor="b-title" className="mb-2 block text-sm font-medium text-ink">Title</label>
              <input id="b-title" required maxLength={80} value={title} placeholder="Pet Review"
                onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(`${streamerName} ${e.target.value}`)); }}
                className="field" />
            </div>

            <div>
              <label htmlFor="b-slug" className="mb-2 block text-sm font-medium text-ink">Address</label>
              <div className={`flex items-center overflow-hidden rounded-xl border bg-well focus-within:border-accent ${slugError ? "border-danger" : "border-line"}`}>
                <span className="max-w-[45%] shrink-0 truncate border-r border-line px-3 py-2.5 text-sm text-subtle">{origin.replace(/^https?:\/\//, "")}/</span>
                <input id="b-slug" required maxLength={48} value={slug} spellCheck={false} autoCapitalize="off" placeholder="streamer-pet-review"
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                  aria-invalid={slugError ? true : undefined} aria-describedby="b-slug-help"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-ink outline-none sm:text-sm" />
              </div>
              <p id="b-slug-help" className={`mt-1.5 text-xs ${slugError ? "text-danger-text" : "text-subtle"}`}>
                {slugError ?? "Lowercase letters, numbers and hyphens. This is the public link you share."}
              </p>
              {slugChanged && !slugError && (
                <p className="mt-1.5 text-xs text-warning-text">Changing the address breaks links you&apos;ve already shared.</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="b-desc" className="text-sm font-medium text-ink">Description</label>
                <span className="text-xs tabular-nums text-subtle">{description.length}/1000</span>
              </div>
              <textarea id="b-desc" rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Show us your pet! Share up to 5 photos for a chance to be featured on stream."
                className="field min-h-24 resize-y" />
              <p className="mt-1.5 text-xs text-subtle">Shown at the top of the public page.</p>
            </div>

            <div>
              <label htmlFor="b-password" className="mb-2 block text-sm font-medium text-ink">Streamer password</label>
              {needsPassword ? (
                <>
                  <div className="flex gap-2">
                    <input id="b-password" required minLength={10} maxLength={128} value={password} spellCheck={false}
                      autoComplete="off" onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={passwordError ? true : undefined} aria-describedby="b-password-help"
                      className="field min-w-0 flex-1 font-mono" />
                    <button type="button" onClick={() => setPassword(generatePassword())} title="Generate a new password"
                      className="pressable flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-muted hover:border-line-strong hover:text-white">
                      <RefreshCw className="size-4" /> Generate
                    </button>
                  </div>
                  <p id="b-password-help" className={`mt-1.5 text-xs ${passwordError ? "text-danger-text" : "text-subtle"}`}>
                    {passwordError ?? "The streamer uses it to open this board's deck. It can't be changed later, only copied, so keep the generated one or pick a strong one."}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-well px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-muted"><KeyRound className="size-4 text-accent-text" /> Set · can&apos;t be changed</span>
                  <CopyButton label="Copy" icon={KeyRound} onError={setError}
                    getText={async () => { const r = await revealBoardPassword(board!.id); if (!r.ok) { setError(r.error); return null; } return r.password; }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong" />
                </div>
              )}
            </div>

            <div className="divide-y divide-line rounded-xl border border-line">
              <Toggle id="b-active" label="Active" checked={isActive} onChange={setIsActive}
                hint="Inactive boards are hidden from the public. Staff can still see them." />
              <Toggle id="b-open" label="Accepting submissions" checked={submissionsOpen} onChange={setSubmissionsOpen}
                hint="When off, the page stays visible but the form is closed." />
              <Toggle id="b-people" label="People may appear in photos" checked={peopleAllowed} onChange={setPeopleAllowed}
                hint="Turn on for boards like costume reviews. Senders must confirm anyone shown agreed to appear, and children are never allowed." />
            </div>

            {peopleAllowed && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-warning-text" />
                Photos of people are personal data. Review every photo carefully before approving, and delete any that show children
                or people who may not have agreed.
              </p>
            )}
            {board && (
              <div className="rounded-xl border border-danger/30 p-4">
                <p className="text-sm font-medium text-ink">Delete board</p>
                <p className="mt-0.5 text-xs leading-relaxed text-subtle">
                  Permanently deletes this board and all {(board.pending ?? 0) + (board.approved ?? 0) > 0 ? <strong className="text-ink">{(board.pending ?? 0) + (board.approved ?? 0)}</strong> : "its"} submissions and photos. Hold the button to confirm.
                </p>
                <HoldButton holdMs={1500} disabled={deleting || saving} onConfirm={remove}
                  label="Delete board" holdingLabel="Keep holding…" icon={<Trash2 className="size-4" />}
                  className="mt-3 flex h-9 items-center rounded-xl border border-danger/40 px-3 text-[13px] font-semibold text-danger-text hover:border-danger/70"
                  fillClassName="bg-danger text-white" />
              </div>
            )}
          </div>

          <footer className="space-y-3 border-t border-line bg-panel px-5 py-4 sm:px-6">
            {error && (
              <p role="alert" className="enter-fade flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger-text">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={saving}
                className="pressable flex h-11 shrink-0 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-muted hover:border-line-strong hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saving || deleting || !!slugError || !!passwordError || !title.trim() || !streamerName.trim()}
                className="pressable flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/45">
                {saving && <Loader2 className="size-4 animate-spin" />} {board ? "Save changes" : "Create board"}
              </button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
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
