import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Trash2, ShieldCheck } from "lucide-react";
import { LEGAL, LEGAL_INCOMPLETE } from "@/config/legal";
import CopyEmail from "@/components/CopyEmail";

export const metadata: Metadata = { title: `Contact · ${LEGAL.projectName}` };

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-white">Contact</h1>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">
        Questions about a submission, a privacy request or anything else: write to us and we&apos;ll get back to you.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line bg-card p-6 shadow-raised">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Mail className="size-4 text-accent-text" /> Email</h2>
          {LEGAL_INCOMPLETE ? (
            <p className="mt-3 text-sm text-warning-text">Contact details haven&apos;t been set up yet.</p>
          ) : (
            <CopyEmail email={LEGAL.contactEmail} />
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-subtle">
            Responsible for this site: {LEGAL.controllerName}, {LEGAL.controllerAddress}. We answer privacy requests within one month.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/delete" className="pressable group block rounded-2xl border border-line bg-card p-5 hover:border-line-strong">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Trash2 className="size-4 text-danger-text" /> Delete my submission</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Have your deletion code? Remove it yourself, instantly.</p>
          </Link>
          <Link href="/privacy" className="pressable group block rounded-2xl border border-line bg-card p-5 hover:border-line-strong">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-accent-text" /> Privacy & photo terms</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">How your data and photos are used, and your rights.</p>
          </Link>
        </div>
      </div>
    </section>
  );
}
