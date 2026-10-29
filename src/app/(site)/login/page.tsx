import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { canViewBoard, getSession, isAdmin } from "@/lib/session";
import { getBoardBySlug } from "@/lib/boards";
import { LEGAL } from "@/config/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Sign in · ${LEGAL.projectName}`, robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const raw = (await searchParams).next;
  const m = typeof raw === "string" ? raw.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(queue|deck)$/) : null;
  const next = m ? raw! : "";
  const board = m ? await getBoardBySlug(m[1]) : null;
  const wantsDeck = m?.[2] === "deck";

  const session = await getSession();
  if (isAdmin(session)) redirect(next || "/");
  if (board && wantsDeck && canViewBoard(session, board.id)) redirect(next);

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <LoginForm
        next={next}
        mode={board && wantsDeck ? "deck" : "admin"}
        boardTitle={board?.title}
        streamerName={board?.streamerName}
        signedInAsStreamer={session?.role === "streamer"}
      />
    </div>
  );
}
