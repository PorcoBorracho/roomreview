import { notFound } from "next/navigation";
import { getBoardBySlug } from "@/lib/boards";
import { canViewBoard, getSession } from "@/lib/session";
import AppHeader from "@/components/AppHeader";

export default async function BoardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [board, session] = await Promise.all([getBoardBySlug(slug), getSession()]);
  const staff = !!board && canViewBoard(session, board.id);
  // Un board inactivo no existe para el público; el equipo puede previsualizarlo
  if (!board || (!board.isActive && !staff)) notFound();

  return (
    <>
      <AppHeader session={session} board={board} staff={staff} />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">{children}</main>
    </>
  );
}
