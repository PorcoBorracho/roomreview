"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Copy, Check, Download, KeyRound } from "lucide-react";
import { LEGAL } from "@/config/legal";
import { useT } from "@/i18n/client";

export default function SubmissionReceipt({ code, onDone }: { code: string; onDone: () => void }) {
  const t = useT();
  const r = t.receipt;
  const link = "font-medium text-accent-text underline underline-offset-4";
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* el usuario puede seleccionarlo a mano */ }
  }

  function download() {
    const text = r.fileText(LEGAL.projectName, code, `${location.origin}/delete`, LEGAL.retentionDays);
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "deletion-code.txt" });
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  return (
    <div role="status" className="enter-rise space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success-text" />
        <div>
          <h3 className="text-lg font-semibold text-strong">{r.title}</h3>
          <p className="mt-1 text-sm text-muted">{r.text}</p>
        </div>
      </div>

      <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning-text">
          <KeyRound className="size-4" /> {r.saveCode}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{r.saveCodeText}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 rounded-lg border border-line bg-well px-3 py-2.5 text-center font-mono text-[15px] font-semibold tracking-wide text-strong select-all">
            {code}
          </code>
          <div className="flex gap-2">
            <button type="button" onClick={copy}
              className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-line-strong sm:flex-none">
              {copied ? <Check className="size-4 text-success-text" /> : <Copy className="size-4" />} {copied ? t.common.copied : t.common.copy}
            </button>
            <button type="button" onClick={download}
              className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-line-strong sm:flex-none">
              {saved ? <Check className="size-4 text-success-text" /> : <Download className="size-4" />} {r.saveTxt}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          {r.useIt(
            <Link href="/delete" className={link}>{r.deletePage}</Link>,
            <Link href="/contact" className={link}>{r.contactPage}</Link>,
            LEGAL.retentionDays,
          )}
        </p>
      </div>

      <button type="button" onClick={onDone}
        className="pressable flex h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted hover:border-line-strong hover:text-strong">
        {r.another}
      </button>
    </div>
  );
}
