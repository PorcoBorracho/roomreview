"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitReport, type ReportState } from "@/actions/problems";
import { useT } from "@/i18n/client";
import Turnstile from "./Turnstile";
import FormError from "./FormError";
import { SubmitButton } from "./LoginForm";
import { useFormAction } from "./useFormAction";

type Props = { page: string; boardSlug: string; boardTitle: string; retentionDays: number };

// Debe coincidir con REPORT_CATEGORIES (lib/validation.ts) y el CHECK de problem_reports
const CATEGORIES = ["bug", "privacy", "content", "access", "other"] as const;

export default function ReportForm(props: Props) {
  // Cambiar la key vuelve a montar el formulario limpio para enviar otro reporte
  const [round, setRound] = useState(0);
  return <ReportFormInner key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function ReportFormInner({ page, boardSlug, boardTitle, retentionDays, onAnother }: Props & { onAnother: () => void }) {
  const t = useT();
  const [state, action, pending] = useFormAction<ReportState>(submitReport, {});
  const [captchaKey, setCaptchaKey] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (state.error) setCaptchaKey((k) => k + 1);
  }, [state]);

  if (state.ok) {
    return (
      <div className="enter-fade py-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-success/15 text-success-text">
          <CheckCircle2 className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-strong">{t.report.sentTitle}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.report.sentText}</p>
        <button type="button" onClick={onAnother}
          className="pressable mx-auto mt-6 inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:border-line-strong">
          {t.report.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={action} className="space-y-5">
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="board" value={boardSlug} />
      {(boardTitle || page) && (
        <p className="rounded-xl border border-line bg-well px-3.5 py-2.5 text-[13px] text-muted">
          <span className="font-medium text-ink">{t.report.about}:</span> {boardTitle || <span className="font-mono">{page}</span>}
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t.report.category}</legend>
        <div className="grid gap-2">
          {CATEGORIES.map((c, i) => (
            <label key={c} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink has-checked:border-accent has-checked:bg-accent/[0.06]">
              <input type="radio" name="category" value={c} required defaultChecked={i === 0} className="accent-[var(--color-accent)]" />
              {t.report.categories[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="r-message" className="text-sm font-medium text-ink">{t.report.message}</label>
          <span className="text-xs tabular-nums text-subtle">{message.length}/2000</span>
        </div>
        <textarea id="r-message" name="message" required minLength={10} maxLength={2000} rows={6} value={message}
          onChange={(e) => setMessage(e.target.value)} placeholder={t.report.messagePlaceholder} className="field min-h-32 resize-y" />
      </div>
      <div>
        <label htmlFor="r-email" className="mb-2 block text-sm font-medium text-ink">{t.report.email}</label>
        <input id="r-email" name="email" type="email" maxLength={254} autoComplete="email" aria-describedby="r-email-hint" className="field" />
        <p id="r-email-hint" className="mt-1.5 text-xs text-subtle">{t.report.emailHint}</p>
      </div>
      <Turnstile action="report" resetKey={captchaKey} />
      <FormError code={state.error} />
      <SubmitButton pending={pending} pendingLabel={t.review.preparing}>
        <Send className="size-4" /> {t.report.send}
      </SubmitButton>
      <p className="text-xs leading-relaxed text-subtle">
        {t.report.retention(retentionDays)}{" "}
        <Link href="/privacy#reports" className="underline hover:text-strong">{t.footer.privacy}</Link>
      </p>
    </form>
  );
}
