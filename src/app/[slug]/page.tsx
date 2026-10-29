import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import SubmitForm from "@/components/SubmitForm";
import { getBoardBySlug } from "@/lib/boards";
import { canViewBoard, getSession } from "@/lib/session";
import { LEGAL } from "@/config/legal";
import { platformLabel } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const board = await getBoardBySlug((await params).slug);
  if (!board || !board.isActive) return { title: "Not found", robots: { index: false } };
  return {
    title: `${board.title} · ${board.streamerName || LEGAL.projectName}`,
    description: board.description.slice(0, 160) || undefined,
  };
}

const STEPS = [
  ["Add your photos", "Up to 5 photos. Location data is removed automatically."],
  ["Review and confirm", "Check the privacy list and agree to the terms. Nothing is sent before that."],
  ["A moderator reviews it", "Approved submissions are shown live on stream."],
] as const;

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const board = await getBoardBySlug((await params).slug);
  const session = await getSession();
  // Un board inactivo no existe para el público; el equipo puede previsualizarlo
  if (!board || (!board.isActive && !canViewBoard(session, board.id))) notFound();

  const open = board.isActive && board.submissionsOpen;

  return (
    <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,42rem)] lg:gap-16 xl:gap-24">
      <section className="lg:sticky lg:top-24 lg:self-start lg:pt-4">
        <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl xl:text-6xl">{board.title}</h1>
        {board.streamerName && (
          <p className="mt-4 text-[15px] text-muted">
            Hosted by <span className="font-semibold text-ink">{board.streamerName}</span>
            {board.platform !== "other" && <> · live on {platformLabel(board.platform)}</>}
          </p>
        )}
        {board.description && (
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed whitespace-pre-line text-muted">{board.description}</p>
        )}

        {open && (
          <ol className="mt-10 hidden max-w-md space-y-5 lg:block">
            {STEPS.map(([title, text], i) => (
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
          <Link href="/privacy" className="hover:text-white">Privacy & photo terms</Link>
          <span className="mx-2">·</span>
          <Link href="/delete" className="hover:text-white">Delete a submission</Link>
        </p>
      </section>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-8">
        {open ? (
          <SubmitForm boardId={board.id} peopleAllowed={board.peopleAllowed} streamerName={board.streamerName} platform={board.platform} />
        ) : (
          <div className="py-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-raised text-muted">
              <Lock className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-white">Submissions are closed</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              This board isn&apos;t accepting new submissions right now. Check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
