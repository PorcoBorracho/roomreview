import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import SubmitForm from "@/components/SubmitForm";
import { getBoard, isPublic } from "@/lib/boards";
import { boardAccess } from "@/lib/session";
import { LEGAL } from "@/config/legal";
import { getT } from "@/i18n/server";
import StreamerAvatar from "@/components/StreamerAvatar";

export const dynamic = "force-dynamic";

type Params = Promise<{ streamer: string; board: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const board = await getBoard(p.streamer, p.board);
  if (!board || !isPublic(board)) return { title: (await getT()).meta.notFound, robots: { index: false } };
  return {
    title: { absolute: `${board.title} · ${board.streamer?.displayName ?? LEGAL.projectName}` },
    description: board.description.slice(0, 160) || undefined,
  };
}

export default async function BoardPage({ params }: { params: Params }) {
  const p = await params;
  const board = await getBoard(p.streamer, p.board);
  // Un board inactivo no existe para el público; el equipo puede previsualizarlo
  if (!board || !board.streamer || (!isPublic(board) && !(await boardAccess(board.id)).view)) notFound();
  const t = await getT();
  const streamer = board.streamer;

  const open = isPublic(board) && board.submissionsOpen;

  return (
    <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,42rem)] lg:gap-16 xl:gap-24">
      <section className="lg:sticky lg:top-24 lg:self-start lg:pt-4">
        <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-strong sm:text-5xl xl:text-6xl">{board.title}</h1>
        <p className="mt-4 flex items-center gap-2.5 text-[15px] text-muted">
          <StreamerAvatar streamer={streamer} size="sm" />
          <span>
            {t.board.hostedBy(<Link href={`/${streamer.login}`} className="font-semibold text-ink hover:underline">{streamer.displayName}</Link>)}
            {t.board.liveOn("Twitch")}
          </span>
        </p>
        {board.description && (
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed whitespace-pre-line text-muted">{board.description}</p>
        )}

        {open && (
          <ol className="mt-10 hidden max-w-md space-y-5 lg:block">
            {t.board.steps.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-[13px] font-semibold text-muted tabular-nums">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-subtle">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-10 hidden text-[13px] text-subtle lg:block">
          <Link href="/privacy" className="hover:text-strong">{t.footer.privacy}</Link>
          <span className="mx-2">·</span>
          <Link href="/delete" className="hover:text-strong">{t.board.deleteASubmission}</Link>
        </p>
      </section>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-8">
        {open ? (
          <SubmitForm boardId={board.id} peopleAllowed={board.peopleAllowed} allowVideos={board.allowVideos} streamerName={streamer.displayName} />
        ) : (
          <div className="py-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-raised text-muted">
              <Lock className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-strong">{t.board.closedTitle}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t.board.closedText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
