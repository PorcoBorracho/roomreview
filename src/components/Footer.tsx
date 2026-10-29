import Link from "next/link";
import { LEGAL, LEGAL_INCOMPLETE } from "@/config/legal";
import { getT } from "@/i18n/server";
import ReportLink from "./ReportLink";

export default async function Footer() {
  const t = await getT();
  return (
    <footer className="border-t border-line">
      {LEGAL_INCOMPLETE && process.env.NODE_ENV !== "production" && (
        <p className="bg-warning/15 px-4 py-2 text-center text-xs font-medium text-warning-text">{t.footer.setupWarning}</p>
      )}
      <div className="shell flex flex-col gap-3 py-6 text-[13px] text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          {LEGAL.projectName}. {t.footer.deletedAfter(LEGAL.retentionDays)}
        </p>
        <nav aria-label={t.footer.privacy} className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-strong">{t.footer.privacy}</Link>
          <Link href="/delete" className="hover:text-strong">{t.footer.deleteMine}</Link>
          <Link href="/contact" className="hover:text-strong">{t.footer.contact}</Link>
          <ReportLink label={t.footer.report} />
        </nav>
      </div>
    </footer>
  );
}
