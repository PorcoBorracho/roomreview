import type { Metadata } from "next";
import Link from "next/link";
import DeleteForm from "@/components/DeleteForm";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = { title: `Delete my submission · ${LEGAL.projectName}`, robots: { index: false } };

export default function DeletePage() {
  return (
    <section className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Delete my submission</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Enter the deletion code you received after submitting. Your details and photos are erased permanently, straight away.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
        <DeleteForm />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        Lost your code?{" "}
        <Link href="/contact" className="font-medium text-accent-text underline underline-offset-4">Contact us</Link>{" "}
        from the email address you used, with your username. We&apos;ll delete it within one month at the latest, usually much sooner.
        If your submission was already shown live, we can remove it from recordings we control, but not from copies others made.
      </p>
    </section>
  );
}
