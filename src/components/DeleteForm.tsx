"use client";

import { Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { useT } from "@/i18n/client";
import FormError from "./FormError";
import { deleteOwnSubmission, type DeleteState } from "@/actions/privacy";
import { useFormAction } from "./useFormAction";

export default function DeleteForm() {
  const t = useT();
  const [state, action, pending] = useFormAction<DeleteState>(deleteOwnSubmission, {});

  if (state.ok) {
    return (
      <div role="status" className="enter-rise flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-text" />
        <div>
          <p className="text-sm font-semibold text-strong">{t.deletePage.doneTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.deletePage.doneText}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={action} className="space-y-4">
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium text-ink">{t.deletePage.code}</label>
        <input id="code" name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
          placeholder="RR-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={40}
          aria-invalid={state.error ? true : undefined}
          className="field font-mono tracking-wide uppercase" />
        <FormError code={state.error} className="mt-2" />
      </div>
      <button type="submit" disabled={pending}
        className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white shadow-raised hover:brightness-110 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {t.deletePage.button}
      </button>
    </form>
  );
}
