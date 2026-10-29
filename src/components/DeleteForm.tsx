"use client";

import { useActionState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { deleteOwnSubmission, type DeleteState } from "@/actions/privacy";

export default function DeleteForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteOwnSubmission, {});

  if (state.ok) {
    return (
      <div role="status" className="enter-rise flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-text" />
        <div>
          <p className="text-sm font-semibold text-strong">Done</p>
          <p className="mt-1 text-sm text-muted">
            If that code matched a submission, it has been deleted with all its photos. Nothing else to do.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="code" className="mb-2 block text-sm font-medium text-ink">Deletion code</label>
        <input id="code" name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
          placeholder="RR-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={40}
          aria-invalid={state.error ? true : undefined}
          className="field font-mono tracking-wide uppercase" />
        {state.error && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger-text">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending}
        className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white shadow-raised hover:brightness-110 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Delete permanently
      </button>
    </form>
  );
}
