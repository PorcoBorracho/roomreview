import { notFound } from "next/navigation";
import { getBoard, isPublic } from "@/lib/boards";
import { boardAccess } from "@/lib/session";
import AppHeader from "@/components/AppHeader";

type Params = Promise<{ streamer: string; board: string }>;

export default async function BoardLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { streamer, board: slug } = await params;
  const board = await getBoard(streamer, slug);
  const staff = !!board && (await boardAccess(board.id)).view;
  // Un board inactivo (o de un streamer suspendido) no existe para el público; el equipo puede previsualizarlo
  if (!board || (!isPublic(board) && !staff)) notFound();

  return (
    <>
      <AppHeader board={board} />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">{children}</main>
    </>
  );
}
