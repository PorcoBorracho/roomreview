import Link from "next/link";
import { LEGAL, LEGAL_INCOMPLETE } from "@/config/legal";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      {LEGAL_INCOMPLETE && process.env.NODE_ENV !== "production" && (
        <p className="bg-warning/15 px-4 py-2 text-center text-xs font-medium text-warning-text">
          Setup: fill in your controller details in <code className="font-mono">src/config/legal.ts</code> before going live.
        </p>
      )}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[13px] text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>{LEGAL.projectName}. Photos are deleted after {LEGAL.retentionDays} days.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-white">Privacy & photo terms</Link>
          <Link href="/delete" className="hover:text-white">Delete my submission</Link>
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-white">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
