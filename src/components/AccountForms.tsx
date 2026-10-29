"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { changePassword, disableTotp, enableTotp, startTotpSetup, type AuthState } from "@/actions/auth";
import { useT } from "@/i18n/client";
import FormError from "./FormError";
import { SubmitButton } from "./LoginForm";
import { Pill } from "./Pill";
import CopyButton from "./CopyButton";
import { useFormAction } from "./useFormAction";

function Success({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-sm text-success-text">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useT();
  const [state, action, pending] = useFormAction<AuthState>(changePassword, {});
  const [formKey, setFormKey] = useState(0);
  // Tras guardar, se vacían los campos
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form key={formKey} onSubmit={action} className="mt-5 space-y-4">
      <div>
        <label htmlFor="current" className="mb-2 block text-sm font-medium text-ink">{forced ? t.account.currentOneTime : t.account.current}</label>
        <input id="current" name="current" type="password" required autoFocus={forced} autoComplete="current-password" maxLength={256} className="field" />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-ink">{t.account.newPassword}</label>
        <input id="new-password" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password"
          aria-describedby="pw-rules" className="field" />
        <p id="pw-rules" className="mt-1.5 text-xs leading-relaxed text-subtle">{t.account.rules}</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-ink">{t.account.confirm}</label>
        <input id="confirm" name="confirm" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="field" />
      </div>
      <FormError code={state.error} />
      {state.ok && <Success>{t.account.saved}</Success>}
      <SubmitButton pending={pending} pendingLabel={t.common.saving}>{t.account.save}</SubmitButton>
    </form>
  );
}

export function TwoFactorPanel({ enabledSince, siteAdmin }: { enabledSince: string | null; siteAdmin: boolean }) {
  const t = useT();
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, start] = useTransition();
  const [enableState, enableAction, enabling] = useFormAction<AuthState>(enableTotp, {});
  const [disableState, disableAction, disabling] = useFormAction<AuthState>(disableTotp, {});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (enableState.ok) {
      setSetup(null);
      setNotice(t.twoFactor.enabled);
      router.refresh();
    }
  }, [enableState, router, t]);
  useEffect(() => {
    if (disableState.ok) {
      setNotice(t.twoFactor.disabled);
      router.refresh();
    }
  }, [disableState, router, t]);

  function begin() {
    setStartError(null);
    setNotice(null);
    start(async () => {
      const r = await startTotpSetup();
      if (r.ok) setSetup({ secret: r.secret, qr: r.qr });
      else setStartError(r.error);
    });
  }

  const on = !!enabledSince;
  const grouped = setup?.secret.match(/.{1,4}/g)?.join(" ") ?? "";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-strong">{t.twoFactor.title}</h2>
        <Pill tone={on ? "success" : "muted"}>{on ? t.twoFactor.on : t.twoFactor.off}</Pill>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{on ? t.twoFactor.onText(enabledSince) : t.twoFactor.offText}</p>
      {!on && siteAdmin && <p className="mt-2 text-sm font-medium text-warning-text">{t.twoFactor.recommended}</p>}
      {notice && <div className="mt-4"><Success>{notice}</Success></div>}

      {!on && !setup && (
        <>
          <button type="button" onClick={begin} disabled={starting}
            className="pressable mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/60">
            {starting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {t.twoFactor.start}
          </button>
          <FormError code={startError} className="mt-3" />
        </>
      )}

      {!on && setup && (
        <form onSubmit={enableAction} className="enter-fade mt-5 space-y-4">
          <p className="text-sm leading-relaxed text-muted">{t.twoFactor.scan}</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* El SVG lo genera el servidor (librería qrcode) a partir de datos propios: no contiene scripts */}
            <div aria-hidden className="size-44 shrink-0 rounded-xl bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: setup.qr }} />
            <div className="w-full min-w-0">
              <p className="text-xs font-medium text-subtle">{t.twoFactor.key}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 rounded-lg bg-well px-2.5 py-2 font-mono text-[13px] break-all text-strong">{grouped}</code>
                <CopyButton getText={() => setup.secret} label={t.common.copy} icon={Copy}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong" />
              </div>
            </div>
          </div>
          <input type="hidden" name="secret" value={setup.secret} />
          <div>
            <label htmlFor="totp-code" className="mb-2 block text-sm font-medium text-ink">{t.twoFactor.code}</label>
            <input id="totp-code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7}
              className="field font-mono tracking-[0.25em] tabular-nums" />
          </div>
          <div>
            <label htmlFor="totp-password" className="mb-2 block text-sm font-medium text-ink">{t.twoFactor.password}</label>
            <input id="totp-password" name="password" type="password" required autoComplete="current-password" maxLength={256} className="field" />
          </div>
          <FormError code={enableState.error} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setSetup(null)}
              className="pressable h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-raised hover:text-strong">{t.common.cancel}</button>
            <div className="flex-1"><SubmitButton pending={enabling} pendingLabel={t.common.checking}>{t.twoFactor.enable}</SubmitButton></div>
          </div>
        </form>
      )}

      {on && (
        <form onSubmit={disableAction} className="mt-5 space-y-4 border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-strong">{t.twoFactor.disableTitle}</h3>
          <p className="-mt-2 text-sm text-muted">{t.twoFactor.disableHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="off-password" className="mb-2 block text-sm font-medium text-ink">{t.twoFactor.password}</label>
              <input id="off-password" name="password" type="password" required autoComplete="current-password" maxLength={256} className="field" />
            </div>
            <div>
              <label htmlFor="off-code" className="mb-2 block text-sm font-medium text-ink">{t.login.totpCode}</label>
              <input id="off-code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                className="field font-mono tracking-[0.25em] tabular-nums" />
            </div>
          </div>
          <FormError code={disableState.error} />
          <button type="submit" disabled={disabling}
            className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-danger-text hover:bg-danger/10 disabled:opacity-60">
            {disabling ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />} {t.twoFactor.disable}
          </button>
          <p className="text-xs leading-relaxed text-subtle">{t.twoFactor.lostPhone}</p>
        </form>
      )}
    </div>
  );
}
