import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, SearchX, Tv } from "lucide-react";
import { getT } from "@/i18n/server";
import { LEGAL } from "@/config/legal";
import { cleanSearch, searchStreamers } from "@/lib/streamers";
import StreamerSearch from "@/components/StreamerSearch";
import StreamerAvatar from "@/components/StreamerAvatar";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { absolute: LEGAL.projectName }, description: t.home.intro };
}

/** Página de inicio pública: buscar los boards de un streamer. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const raw = (await searchParams).q;
  const q = cleanSearch(typeof raw === "string" ? raw : "");
  const results = await searchStreamers(q);

  return (
    <div className="mx-auto max-w-[1100px]">
      <section className="mx-auto max-w-2xl pt-6 text-center sm:pt-14">
        <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-strong sm:text-5xl">{t.home.title}</h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-relaxed text-pretty text-muted">{t.home.intro}</p>
        <div className="mt-8 text-left">
          <StreamerSearch initial={q} />
        </div>
      </section>

      <section aria-labelledby="results-title" className="mt-12 sm:mt-16">
        <h2 id="results-title" className="text-sm font-semibold text-subtle">
          {q ? t.home.resultsFor(q) : t.home.featured}
        </h2>

        {results.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            {q ? <SearchX className="mx-auto size-8 text-subtle" /> : <Tv className="mx-auto size-8 text-subtle" />}
            <p className="mt-3 text-base font-semibold text-strong">{q ? t.home.noResults : t.home.nothingYet}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{q ? t.home.noResultsText : t.home.nothingYetText}</p>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
            {results.map((s) => (
              <li key={s.id}>
                <Link href={`/${s.login}`}
                  className="pressable group flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4 shadow-raised hover:border-line-strong">
                  <StreamerAvatar streamer={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-strong">{s.displayName}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-subtle">
                      {s.open > 0 ? <span className="font-medium text-success-text">{t.home.openBoards(s.open)}</span> : t.home.boards(s.boards)}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-strong" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
