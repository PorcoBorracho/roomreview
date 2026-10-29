import { notFound } from "next/navigation";
import { getBoardBySlug } from "@/lib/boards";
import { boardAccess } from "@/lib/session";
import AppHeader from "@/components/AppHeader";

export default async function BoardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  const staff = !!board && (await boardAccess(board.id)).view;
  // Un board inactivo no existe para el público; el equipo puede previsualizarlo
  if (!board || (!board.isActive && !staff)) notFound();

  return (
    <>
      <AppHeader board={board} />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">{children}</main>
    </>
  );
}
