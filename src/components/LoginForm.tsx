"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Loader2, Tv, ShieldCheck, Smartphone, ArrowRight } from "lucide-react";
import { accountLogin, boardLogin, verifyLoginTotp, type AuthState } from "@/actions/auth";
import { useT } from "@/i18n/client";
import Turnstile from "./Turnstile";
import FormError from "./FormError";
import { useFormAction } from "./useFormAction";

type Props = {
  next: string;
  mode: "account" | "board";
  target: "queue" | "deck";
  slug: string;
  boardTitle?: string;
  streamerName?: string;
  hasBoardSession: boolean;
  setupNeeded: boolean;
  alreadySignedIn: boolean;
};

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <button type="submit" disabled={pending}
      className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/60">
      {pending ? <><Loader2 className="size-4 animate-spin" /> {pendingLabel}</> : children}
    </button>
  );
}

export default function LoginForm(props: Props) {
  const t = useT();
  const [state, action, pending] = useFormAction<AuthState>(props.mode === "board" ? boardLogin : accountLogin, {});
  const [captchaKey, setCaptchaKey] = useState(0);
  // Cada intento gasta el token de Turnstile: tras un error se pide uno nuevo
  useEffect(() => {
    if (state.error) setCaptchaKey((k) => k + 1);
  }, [state]);

  if (state.step === "totp") return <TotpStep next={props.next} />;

  const board = props.mode === "board";
  const queue = props.target === "queue";
  const Icon = board ? (queue ? ShieldCheck : Tv) : Lock;
  const intro = board
    ? queue ? t.login.queueIntro : t.login.deckIntro(props.streamerName ?? "")
    : props.hasBoardSession ? t.login.needsAccount : t.login.adminIntro;
  const accountHref = `/login?next=${encodeURIComponent(props.next)}&with=account`;
  const boardHref = `/login?next=${encodeURIComponent(props.next)}`;

  return (
    <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        <Icon className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-strong">{board ? props.boardTitle : t.login.adminTitle}</h1>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{intro}</p>

      {props.setupNeeded && (
        <p className="mt-4 rounded-xl border border-line bg-well px-3.5 py-3 text-sm text-muted">
          {t.login.setupNeeded}{" "}
          <Link href="/setup" className="font-semibold text-accent-text hover:underline">{t.login.setupLink}</Link>
        </p>
      )}

      <form onSubmit={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={props.next} />
        {board && (
          <>
            <input type="hidden" name="slug" value={props.slug} />
            <input type="hidden" name="target" value={props.target} />
          </>
        )}
        {!board && (
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-ink">{t.login.username}</label>
            <input id="username" name="username" type="text" required autoFocus autoComplete="username" autoCapitalize="none"
              spellCheck={false} maxLength={32} className="field" />
          </div>
        )}
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">{t.login.password}</label>
          <input id="password" name="password" type="password" required autoFocus={board} autoComplete="current-password"
            maxLength={256} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "login-error" : undefined}
            className="field" />
        </div>
        <Turnstile action="login" resetKey={captchaKey} />
        <FormError id="login-error" code={state.error} />
        <SubmitButton pending={pending} pendingLabel={t.common.checking}>
          {board ? (queue ? t.login.openQueue : t.login.openDeck) : t.login.signIn}
        </SubmitButton>
      </form>

      {!props.alreadySignedIn && (
        <p className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted">
          {board ? (
            <>
              {t.login.haveAccount}{" "}
              <Link href={accountHref} className="font-semibold text-accent-text hover:underline">{t.login.useAccount}</Link>
            </>
          ) : props.slug ? (
            <Link href={boardHref} className="font-semibold text-accent-text hover:underline">{t.login.useBoardPassword}</Link>
          ) : null}
        </p>
      )}
    </div>
  );
}

function TotpStep({ next }: { next: string }) {
  const t = useT();
  const [state, action, pending] = useFormAction<AuthState>(verifyLoginTotp, { step: "totp" });
  if (state.error === "mfaExpired") {
    return (
      <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
        <FormError code={state.error} />
        <a href="/login" className="pressable mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-raised text-sm font-semibold text-strong">
          {t.login.startOver} <ArrowRight className="size-4" />
        </a>
      </div>
    );
  }
  return (
    <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        <Smartphone className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-strong">{t.login.totpTitle}</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t.login.totpIntro}</p>
      <form onSubmit={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="code" className="mb-2 block text-sm font-medium text-ink">{t.login.totpCode}</label>
          <input id="code" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}"
            maxLength={7} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "totp-error" : undefined}
            className="field text-center font-mono text-lg tracking-[0.3em] tabular-nums" />
        </div>
        <FormError id="totp-error" code={state.error} />
        <SubmitButton pending={pending} pendingLabel={t.common.checking}>{t.login.verify}</SubmitButton>
      </form>
      <p className="mt-5 border-t border-line pt-4 text-center text-[13px]">
        <a href="/login" className="font-semibold text-accent-text hover:underline">{t.login.startOver}</a>
      </p>
    </div>
  );
}
