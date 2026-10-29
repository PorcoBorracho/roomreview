"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { setupSiteAdmin, type AuthState } from "@/actions/auth";
import { useT } from "@/i18n/client";
import Turnstile from "./Turnstile";
import FormError from "./FormError";
import { SubmitButton } from "./LoginForm";
import { useFormAction } from "./useFormAction";

export default function SetupForm() {
  const t = useT();
  const [state, action, pending] = useFormAction<AuthState>(setupSiteAdmin, {});
  const [captchaKey, setCaptchaKey] = useState(0);
  useEffect(() => {
    if (state.error) setCaptchaKey((k) => k + 1);
  }, [state]);

  return (
    <div className="enter-zoom w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-float sm:p-7">
      <div className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
        <KeyRound className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-strong">{t.setup.title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{t.setup.intro}</p>
      <form onSubmit={action} className="mt-6 space-y-4">
        <div>
          <label htmlFor="setupPassword" className="mb-2 block text-sm font-medium text-ink">{t.setup.setupPassword}</label>
          <input id="setupPassword" name="setupPassword" type="password" required autoFocus autoComplete="off" maxLength={256} className="field" />
        </div>
        <div>
          <label htmlFor="username" className="mb-2 block text-sm font-medium text-ink">{t.setup.username}</label>
          <input id="username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false}
            maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{1,30}[a-zA-Z0-9]" aria-describedby="username-hint" className="field" />
          <p id="username-hint" className="mt-1.5 text-xs text-subtle">{t.setup.usernameHint}</p>
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">{t.setup.newPassword}</label>
          <input id="password" name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password"
            aria-describedby="password-rules" className="field" />
          <p id="password-rules" className="mt-1.5 text-xs text-subtle">{t.account.rules}</p>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-ink">{t.setup.confirm}</label>
          <input id="confirm" name="confirm" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="field" />
        </div>
        <Turnstile action="login" resetKey={captchaKey} />
        <FormError code={state.error} />
        <SubmitButton pending={pending} pendingLabel={t.common.checking}>{t.setup.create}</SubmitButton>
      </form>
    </div>
  );
}
