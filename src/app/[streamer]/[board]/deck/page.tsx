import { notFound } from "next/navigation";
import { requireBoardPage } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBoard } from "@/lib/boards";
import { mediaKind, signPaths } from "@/lib/media";
import { getT } from "@/i18n/server";
import StreamerDeck from "@/components/StreamerDeck";
import type { DeckSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: (await getT()).deck.title, robots: { index: false } });

type Row = {
  id: string; username: string; country: string; description: string; submitted_at: string;
  submission_media: { id: string; storage_path: string; position: number; content_type: string }[];
};

export default async function DeckPage({ params }: { params: Promise<{ streamer: string; board: string }> }) {
  const p = await params;
  const board = await getBoard(p.streamer, p.board);
  if (!board?.streamer) notFound();
  await requireBoardPage(board.id, "view", `/${board.streamer.login}/${board.slug}/deck`);

  // Nunca se envía el email al navegador en esta vista
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select("id, username, country, description, submitted_at, submission_media(id, storage_path, position, content_type)")
    .eq("board_id", board.id)
    .eq("status", "approved")
    .order("submitted_at", { ascending: true })
    .limit(500);
  if (error) throw new Error("Could not load submissions");

  const rows = (data ?? []) as Row[];
  const urls = await signPaths(rows.flatMap((r) => r.submission_media.map((m) => m.storage_path)), 4 * 3600);

  const deck: DeckSubmission[] = rows
    .map((r) => ({
      id: r.id,
      username: r.username,
      country: r.country,
      description: r.description,
      submittedAt: r.submitted_at,
      media: [...r.submission_media]
        .sort((a, b) => a.position - b.position)
        .map((m) => ({ id: m.id, url: urls.get(m.storage_path) ?? "", kind: mediaKind(m.content_type) }))
        .filter((m) => m.url),
    }))
    .filter((s) => s.media.length > 0);

  return <StreamerDeck submissions={deck} blurNew={board.blurNew} />;
}
