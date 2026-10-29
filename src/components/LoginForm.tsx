"use client";

import { useActionState } from "react";
import { Lock, Loader2, AlertCircle, Tv } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";

type Props = {
  next: string;
  mode: "admin" | "deck";
  boardTitle?: string;
  streamerName?: string;
  signedInAsStreamer: boolean;
};

export default function LoginForm({ next, mode, boardTitle, streamerName, signedInAsStreamer }: Props) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const deck = mode === "deck";

  return (
    <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        {deck ? <Tv className="size-5" /> : <Lock className="size-5" />}
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-white">{deck ? boardTitle : "Admin sign in"}</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {deck
          ? <>Enter the streamer password{streamerName ? <> for {streamerName}</> : null} to open this deck.</>
          : signedInAsStreamer
            ? "This page is for admins. Streamers can only open the decks they have a password for."
            : "Enter the admin password."}
      </p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">Password</label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password"
            maxLength={256} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "pw-error" : undefined}
            className="field" />
          {state.error && (
            <p id="pw-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger-text">
              <AlertCircle className="size-4 shrink-0" /> {state.error}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending}
          className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/60">
          {pending ? <><Loader2 className="size-4 animate-spin" /> Checking…</> : deck ? "Open deck" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
