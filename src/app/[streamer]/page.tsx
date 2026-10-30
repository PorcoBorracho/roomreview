import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ExternalLink, Inbox, Lock } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import StreamerAvatar from "@/components/StreamerAvatar";
import { Pill } from "@/components/Pill";
import { getStreamerByLogin } from "@/lib/streamers";
import { listPublicBoards } from "@/lib/boards";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ streamer: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await getStreamerByLogin((await params).streamer);
  const t = await getT();
  if (!s || s.status !== "active") return { title: t.meta.notFound, robots: { index: false } };
  return { title: s.displayName, description: t.streamerPage.metaDescription(s.displayName) };
}

/** Página pública de un streamer: todos sus boards activos. */
export default async function StreamerPage({ params }: { params: Params }) {
  const login = (await params).streamer;
  const streamer = await getStreamerByLogin(login);
  if (!streamer || streamer.status !== "active") notFound();
  // Siempre en minúsculas: una sola dirección por streamer
  if (login !== streamer.login) redirect(`/${streamer.login}`);
  const [t, boards] = await Promise.all([getT(), listPublicBoards(streamer.id)]);

  return (
    <>
      <AppHeader streamer={streamer} />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">
        <div className="mx-auto max-w-[1100px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <StreamerAvatar streamer={streamer} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-3xl font-extrabold tracking-tight text-strong sm:text-4xl">{streamer.displayName}</h1>
              <p className="mt-1 text-[15px] text-muted">{t.streamerPage.subtitle(boards.length)}</p>
            </div>
            <a href={`https://www.twitch.tv/${streamer.login}`} target="_blank" rel="noreferrer noopener"
              className="pressable flex h-10 shrink-0 items-center gap-2 self-start rounded-xl border border-line px-3.5 text-sm font-semibold text-ink hover:border-line-strong sm:self-auto">
              {t.streamerPage.watchOnTwitch} <ExternalLink className="size-3.5 text-subtle" />
            </a>
          </header>

          {boards.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
              <Inbox className="mx-auto size-8 text-subtle" />
              <p className="mt-3 text-base font-semibold text-strong">{t.streamerPage.emptyTitle}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.streamerPage.emptyText}</p>
            </div>
          ) : (
            <ul className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4">
              {boards.map((b) => (
                <li key={b.id}>
                  <Link href={`/${streamer.login}/${b.slug}`}
                    className="pressable group flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-raised hover:border-line-strong">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-lg leading-snug font-semibold text-strong">{b.title}</span>
                      {b.submissionsOpen ? <Pill tone="success">{t.status.open}</Pill> : <Pill tone="muted">{t.status.closed}</Pill>}
                    </span>
                    {b.description && <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{b.description}</span>}
                    <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent-text">
                      {b.submissionsOpen ? (
                        <>{t.streamerPage.submit} <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" /></>
                      ) : (
                        <><Lock className="size-3.5" /> {t.streamerPage.view}</>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
