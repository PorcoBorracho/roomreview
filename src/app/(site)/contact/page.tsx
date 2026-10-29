import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Trash2, ShieldCheck, Flag } from "lucide-react";
import { LEGAL, LEGAL_INCOMPLETE } from "@/config/legal";
import CopyEmail from "@/components/CopyEmail";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).contact.title };
}

export default async function ContactPage() {
  const t = await getT();
  const c = t.contact;
  const cards = [
    { href: "/delete", icon: <Trash2 className="size-4 text-danger-text" />, title: c.deleteTitle, text: c.deleteText },
    { href: "/privacy", icon: <ShieldCheck className="size-4 text-accent-text" />, title: c.privacyTitle, text: c.privacyText },
    { href: "/report?page=%2Fcontact", icon: <Flag className="size-4 text-warning-text" />, title: c.reportTitle, text: c.reportText },
  ];
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-strong">{c.title}</h1>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-muted">{c.intro}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line bg-card p-6 shadow-raised">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Mail className="size-4 text-accent-text" /> {c.email}</h2>
          {LEGAL_INCOMPLETE ? (
            <p className="mt-3 text-sm text-warning-text">{c.notSetUp}</p>
          ) : (
            <CopyEmail email={LEGAL.contactEmail} />
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-subtle">{c.responsible(LEGAL.controllerName, LEGAL.controllerAddress)}</p>
        </div>

        <div className="space-y-4">
          {cards.map((k) => (
            <Link key={k.href} href={k.href} className="pressable group block rounded-2xl border border-line bg-card p-5 hover:border-line-strong">
              <p className="flex items-center gap-2 text-sm font-semibold text-strong">{k.icon} {k.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{k.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
