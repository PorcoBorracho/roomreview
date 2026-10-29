"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Copy, Check, Download, KeyRound } from "lucide-react";
import { LEGAL } from "@/config/legal";

export default function SubmissionReceipt({ code, onDone }: { code: string; onDone: () => void }) {
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
    const text = `${LEGAL.projectName}\n\nYour deletion code: ${code}\n\nTo delete your submission at any time, go to ${location.origin}/delete and enter this code.\nSubmissions are deleted automatically after ${LEGAL.retentionDays} days.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "room-review-deletion-code.txt" });
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  return (
    <div role="status" className="enter-rise space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success-text" />
        <div>
          <h3 className="text-lg font-semibold text-white">Submission received</h3>
          <p className="mt-1 text-sm text-muted">
            A moderator will review it. Nothing is shown on stream until it&apos;s approved.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-warning/40 bg-warning/[0.07] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning-text">
          <KeyRound className="size-4" /> Save your deletion code now
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          It&apos;s the only way to delete your submission yourself. We don&apos;t store it in readable form, so it
          can&apos;t be shown again.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 rounded-lg border border-line bg-well px-3 py-2.5 text-center font-mono text-[15px] font-semibold tracking-wide text-white select-all">
            {code}
          </code>
          <div className="flex gap-2">
            <button type="button" onClick={copy}
              className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-line-strong sm:flex-none">
              {copied ? <Check className="size-4 text-success-text" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={download}
              className="pressable flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink hover:border-line-strong sm:flex-none">
              {saved ? <Check className="size-4 text-success-text" /> : <Download className="size-4" />} Save .txt
            </button>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Use it on the{" "}
          <Link href="/delete" className="font-medium text-accent-text underline underline-offset-4">delete my submission</Link>{" "}
          page. Without it, email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent-text underline underline-offset-4">{LEGAL.contactEmail}</a>.
          Submissions are deleted automatically after {LEGAL.retentionDays} days.
        </p>
      </div>

      <button type="button" onClick={onDone}
        className="pressable flex h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted hover:border-line-strong hover:text-white">
        I&apos;ve saved my code, submit another room
      </button>
    </div>
  );
}
