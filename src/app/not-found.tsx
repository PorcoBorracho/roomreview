import Link from "next/link";
import { SearchX } from "lucide-react";
import { getT } from "@/i18n/server";
import { LEGAL } from "@/config/legal";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="shell flex flex-grow items-center justify-center py-24">
      <div className="text-center">
        <SearchX className="mx-auto size-9 text-subtle" />
        <p className="mt-4 text-sm font-semibold text-subtle tabular-nums">404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-strong">{t.meta.notFound}</h1>
        <Link href="/" className="pressable mt-6 inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:border-line-strong">
          {LEGAL.projectName}
        </Link>
      </div>
    </main>
  );
}
