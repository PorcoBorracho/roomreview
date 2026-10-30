"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, KeyRound, ShieldPlus, ShieldMinus, Trash2, Copy, ShieldCheck, TriangleAlert } from "lucide-react";
import { createAdmin, deleteAdmin, resetAdminPassword, setAdminRole } from "@/actions/accounts";
import type { AdminListItem } from "@/lib/accounts";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/config";
import FormError from "./FormError";
import HoldButton from "./HoldButton";
import CopyButton from "./CopyButton";
import { Pill } from "./Pill";

export type Secret = { title: string; username: string; password: string };

const rowBtn = "pressable flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50";

export default function AdminsManager({ admins, meId, otpHours }: { admins: AdminListItem[]; meId: string; otpHours: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const site = admins.filter((a) => a.role === "site_admin" || a.role === "owner").length;

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string; password?: string }>, onOk?: (r: { password?: string }) => void) {
    setError(null);
    setBusy(id);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) setError(r.error ?? "db");
      else onOk?.(r);
      router.refresh();
    });
  }

  return (
    <section className="mx-auto max-w-[1100px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.admins.title}</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">{t.admins.summary(admins.length, site)}</p>
        </div>
        <button onClick={() => { setError(null); setCreating(true); }}
          className="pressable flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover">
          <Plus className="size-4" /> {t.admins.newAdmin}
        </button>
      </header>

      {error && (
        <div role="alert" className="enter-fade mt-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
          <FormError code={error} className="flex-1" />
          <button onClick={() => setError(null)} className="text-xs font-semibold text-danger-text underline">{t.common.dismiss}</button>
        </div>
      )}

      <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-raised">
        {admins.map((a) => {
          const me = a.id === meId;
          // El Owner no se gestiona desde aquí (ni por los Site Admins)
          const locked = me || a.role === "owner";
          return (
            <li key={a.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-strong">{a.username}</span>
                  {me && <span className="text-xs text-subtle">({t.admins.youTag})</span>}
                  <Pill tone={a.role === "admin" ? "muted" : "accent"}>{t.header.roles[a.role]}</Pill>
                  {a.status !== "active" && <Pill tone="warning">{t.admins.status[a.status]}</Pill>}
                  {a.totpEnabled
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text"><ShieldCheck className="size-3.5" /> {t.admins.twoFactorOn}</span>
                    : <span className="text-xs text-subtle">{t.admins.twoFactorOff}</span>}
                </p>
                <p className="mt-1 text-[13px] text-subtle">
                  {t.admins.lastLogin(a.lastLoginAt ? formatDate(locale, a.lastLoginAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : t.common.never)}
                  <span className="mx-1.5">·</span>
                  <span className="tabular-nums">{t.admins.boards(a.boards)}</span>
                  {a.streamers.length > 0 && (
                    <>
                      <span className="mx-1.5">·</span>
                      {t.admins.teamOf(a.streamers.map((x) => `@${x.login}`).join(", "))}
                    </>
                  )}
                </p>
              </div>
              {!locked && (
                <div className="flex flex-wrap items-center gap-2">
                  <HoldButton holdMs={800} disabled={busy === a.id}
                    onConfirm={() => run(a.id, () => resetAdminPassword(a.id), (r) => r.password && setSecret({ title: t.admins.resetTitle(a.username), username: a.username, password: r.password }))}
                    label={t.admins.resetPassword} holdingLabel={t.common.keepHolding} icon={<KeyRound className="size-4" />}
                    className="flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong"
                    fillClassName="bg-accent text-on-accent" />
                  <button type="button" disabled={busy === a.id} className={rowBtn}
                    onClick={() => run(a.id, () => setAdminRole(a.id, a.role === "site_admin" ? "admin" : "site_admin"))}>
                    {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : a.role === "site_admin" ? <ShieldMinus className="size-4" /> : <ShieldPlus className="size-4" />}
                    {a.role === "site_admin" ? t.admins.removeSite : t.admins.makeSite}
                  </button>
                  <span title={t.admins.deleteHint(a.username)}>
                    <HoldButton holdMs={1500} disabled={busy === a.id} onConfirm={() => run(a.id, () => deleteAdmin(a.id))}
                      label={t.admins.deleteButton} holdingLabel={t.common.keepHolding} icon={<Trash2 className="size-4" />}
                      className="flex h-8 items-center rounded-lg border border-danger/40 px-2.5 text-[13px] font-semibold text-danger-text hover:border-danger/70"
                      fillClassName="bg-danger text-white" />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-subtle">{t.admins.resetHint} {t.admins.ownerHint}</p>

      <CreateDialog open={creating} onClose={() => setCreating(false)}
        onCreated={(username, password) => { setCreating(false); setSecret({ title: t.admins.createdTitle(username), username, password }); router.refresh(); }} />
      <SecretDialog secret={secret} otpHours={otpHours} onClose={() => setSecret(null)} />
    </section>
  );
}

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: string, pw: string) => void }) {
  const t = useT();
  const ref = useModal(open);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "site_admin">("admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { if (open) { setUsername(""); setRole("admin"); setError(null); } }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await createAdmin(username, role);
    setPending(false);
    if (!r.ok) return setError(r.error);
    onCreated(r.username, r.password);
  }

  return (
    <dialog ref={ref} aria-labelledby="create-admin-title" onCancel={(e) => { e.preventDefault(); if (!pending) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
      className="review-dialog m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-float">
      {open && (
        <form onSubmit={submit}>
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <h2 id="create-admin-title" className="text-lg font-semibold text-strong">{t.admins.createTitle}</h2>
            <button type="button" onClick={onClose} aria-label={t.common.close} className="pressable -m-1 rounded-lg p-1.5 text-subtle hover:text-strong"><X className="size-5" /></button>
          </header>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div>
              <label htmlFor="new-username" className="mb-2 block text-sm font-medium text-ink">{t.admins.username}</label>
              <input id="new-username" required autoFocus value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="new-username-hint" className="field" />
              <p id="new-username-hint" className="mt-1.5 text-xs text-subtle">{t.setup.usernameHint}</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">{t.admins.role}</legend>
              <div className="space-y-2">
                {(["admin", "site_admin"] as const).map((r) => (
                  <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3 has-checked:border-accent has-checked:bg-accent/[0.06]">
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-0.5 accent-[var(--color-accent)]" />
                    <span className="text-sm text-ink">{r === "admin" ? t.admins.roleAdmin : t.admins.roleSite}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <FormError code={error} />
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-panel px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} className="pressable flex h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-muted hover:text-strong">{t.common.cancel}</button>
            <button type="submit" disabled={pending || username.trim().length < 3}
              className="pressable flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/45">
              {pending && <Loader2 className="size-4 animate-spin" />} {t.admins.create}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}

/** Contraseña de un solo uso: se muestra una única vez */
export function SecretDialog({ secret, otpHours, onClose }: { secret: Secret | null; otpHours: number; onClose: () => void }) {
  const t = useT();
  const ref = useModal(!!secret);
  return (
    <dialog ref={ref} aria-labelledby="secret-title" onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="review-dialog m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-float">
      {secret && (
        <div>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <h2 id="secret-title" className="text-lg font-semibold text-strong">{secret.title}</h2>
            <p className="text-sm leading-relaxed text-pretty text-muted">{t.admins.oneTimeText(otpHours)}</p>
            <dl className="space-y-3 rounded-xl border border-line bg-well p-4">
              <div>
                <dt className="text-xs font-medium text-subtle">{t.admins.username}</dt>
                <dd className="mt-0.5 font-mono text-sm text-strong">{secret.username}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-subtle">{t.admins.oneTimeTitle}</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 font-mono text-base break-all text-strong">{secret.password}</code>
                  <CopyButton label={t.common.copy} icon={Copy} getText={() => `${secret.username}\n${secret.password}`}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-semibold text-ink hover:border-line-strong" />
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-warning-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t.admins.shownOnce}
            </p>
          </div>
          <footer className="flex justify-end border-t border-line bg-panel px-5 py-4 sm:px-6">
            <button type="button" onClick={onClose} autoFocus
              className="pressable flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover">
              {t.admins.done}
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
