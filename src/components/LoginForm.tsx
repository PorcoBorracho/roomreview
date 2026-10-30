"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Loader2, Tv, ShieldCheck, Smartphone, ArrowRight, Info, Clock } from "lucide-react";
import { accountLogin, boardLogin, verifyLoginTotp, type AuthState } from "@/actions/auth";
import { useT } from "@/i18n/client";
import Turnstile from "./Turnstile";
import FormError from "./FormError";
import { useFormAction } from "./useFormAction";

type Props = {
  next: string;
  mode: "account" | "board";
  target: "queue" | "deck";
  /** Login del streamer y nombre del board (modo board) */
  streamer: string;
  slug: string;
  boardTitle?: string;
  streamerName?: string;
  hasBoardSession: boolean;
  setupNeeded: boolean;
  alreadySignedIn: boolean;
  /** ¿Está configurada la entrada con Twitch? */
  twitch: boolean;
  /** Resultado de una entrada con Twitch (?twitch=…) */
  notice: "pending" | "suspended" | "denied" | "error" | "reserved" | "full" | "off" | "busy" | null;
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
  // Twitch: para los streamers. Desde el login de un deck se vuelve a ese deck.
  const twitchNext = props.next && !props.next.endsWith("/queue") ? props.next : "";
  const twitchHref = `/api/auth/twitch${twitchNext ? `?next=${encodeURIComponent(twitchNext)}` : ""}`;
  const showTwitch = props.twitch && !(board && queue);

  return (
    <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        <Icon className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-strong">{board ? props.boardTitle : t.login.adminTitle}</h1>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{intro}</p>

      {props.notice && (
        <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${
          props.notice === "pending" ? "border-accent/30 bg-accent/[0.06] text-ink" : "border-warning/30 bg-warning/[0.06] text-ink"}`}>
          {props.notice === "pending" ? <Clock className="mt-0.5 size-4 shrink-0 text-accent-text" /> : <Info className="mt-0.5 size-4 shrink-0 text-warning-text" />}
          <span>{t.login.twitchNotice[props.notice]}</span>
        </p>
      )}

      {showTwitch && !board && (
        <>
          <TwitchButton href={twitchHref} label={t.login.twitchButton} />
          <p className="mt-2 text-center text-xs text-subtle">{t.login.twitchHint}</p>
          <div className="my-5 flex items-center gap-3 text-xs text-subtle" aria-hidden>
            <span className="h-px flex-1 bg-line" /> {t.login.orStaff} <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

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
            <input type="hidden" name="streamer" value={props.streamer} />
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

      {!props.alreadySignedIn && (board || props.slug) && (
        <p className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted">
          {board ? (
            <>
              {showTwitch && (
                <a href={twitchHref} className="mb-2 block font-semibold text-accent-text hover:underline">{t.login.twitchDeck}</a>
              )}
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

/** Botón para entrar con Twitch (un <a> normal, no un Link de Next: /api no se precarga) */
function TwitchButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href}
      className="pressable mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#9146FF] text-sm font-semibold text-white shadow-raised hover:bg-[#7c3aed]">
      <Tv aria-hidden className="size-4" />
      {label}
    </a>
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
