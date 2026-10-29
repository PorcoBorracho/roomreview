import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/config/legal";
import { AUDIT_DAYS, REPORT_MAX_DAYS, REPORT_RESOLVED_DAYS } from "@/lib/limits";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/i18n/config";
import type { PrivacyDoc } from "@/i18n/privacy/types";
import en from "@/i18n/privacy/en";
import es from "@/i18n/privacy/es";
import pt from "@/i18n/privacy/pt";
import fr from "@/i18n/privacy/fr";
import ja from "@/i18n/privacy/ja";

const DOCS: Record<string, PrivacyDoc> = { en, es, pt, fr, ja };

export async function generateMetadata(): Promise<Metadata> {
  return { title: DOCS[await getLocale()].title };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = DOCS[locale];
  const L = LEGAL;
  const mail = <Link href="/contact">{L.contactEmail}</Link>;
  const sections = doc.sections({
    L,
    mail,
    del: (text) => <Link href="/delete">{text}</Link>,
    report: (text) => <Link href="/report?page=%2Fprivacy">{text}</Link>,
    controller: (
      <>
        <strong>{L.controllerName}</strong>
        {L.controllerTaxId ? <> ({L.controllerTaxId})</> : null}, {L.controllerAddress}. {doc.contactLabel}: {mail}
      </>
    ),
    reportResolvedDays: REPORT_RESOLVED_DAYS,
    reportMaxDays: REPORT_MAX_DAYS,
    auditDays: AUDIT_DAYS - 1,
  });
  // La fecha sale de la versión (AAAA-MM-DD.n), en el formato de cada idioma
  const day = /^\d{4}-\d{2}-\d{2}/.exec(L.policyVersion)?.[0];
  const updated = day ? formatDate(locale, `${day}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:gap-16">
      <aside className="hidden lg:block">
        <nav aria-label={doc.onThisPage} className="sticky top-24">
          <p className="text-xs font-semibold text-subtle">{doc.onThisPage}</p>
          <ul className="mt-3 space-y-1 border-l border-line">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-[13px] text-muted hover:border-line-strong hover:text-strong">
                  {s.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article className="max-w-[72ch]">
        <h1 className="text-3xl font-bold tracking-tight text-balance text-strong sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-subtle">{doc.version(L.policyVersion, updated)}</p>

        <div className="legal mt-8 space-y-9">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
