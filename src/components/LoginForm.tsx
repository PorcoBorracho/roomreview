"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";

export default function LoginForm({ role, next }: { role: "admin" | "viewer"; next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const title = role === "admin" ? "Admin queue" : "Streamer view";

  return (
    <div className="enter-zoom w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        <Lock className="size-5" />
      </div>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm text-muted">Enter the password to continue.</p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="role" value={role} />
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
        <div className="flex gap-2 pt-1">
          <Link href="/" className="pressable flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted hover:border-line-strong hover:text-white">
            Cancel
          </Link>
          <button type="submit" disabled={pending}
            className="pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:bg-accent/60">
            {pending ? <><Loader2 className="size-4 animate-spin" /> Checking…</> : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
