import type { Metadata } from "next";
import Link from "next/link";
import DeleteForm from "@/components/DeleteForm";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).deletePage.title, robots: { index: false } };
}

export default async function DeletePage() {
  const t = await getT();
  return (
    <section className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight text-strong sm:text-3xl">{t.deletePage.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted">{t.deletePage.intro}</p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-6">
        <DeleteForm />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-pretty text-muted">
        {t.deletePage.lost(<Link href="/contact" className="font-medium text-accent-text underline underline-offset-4">{t.deletePage.contactUs}</Link>)}
      </p>
    </section>
  );
}
