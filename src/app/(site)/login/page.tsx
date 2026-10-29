import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { activeAccount, boardAccess, getSession } from "@/lib/session";
import { getBoardBySlug } from "@/lib/boards";
import { hasAnyAdmin } from "@/lib/accounts";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).login.signIn, robots: { index: false } };
}

const BOARD_NEXT = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(queue|deck)$/;
const ACCOUNT_NEXT = /^\/(?:admins|problems|audit|account)?$/;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; with?: string }> }) {
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "";
  const m = raw.match(BOARD_NEXT);
  const next = m || ACCOUNT_NEXT.test(raw) ? raw : "";
  const board = m ? await getBoardBySlug(m[1]) : null;
  const target = (m?.[2] ?? null) as "queue" | "deck" | null;

  const session = await getSession();
  if (session.account?.mustChange) redirect("/account/password");
  const acc = activeAccount(session);

  // Si ya tiene permiso para ir adonde quería, no hace falta volver a entrar
  if (board && target) {
    const access = await boardAccess(board.id);
    if (target === "queue" ? access.moderate : access.view) redirect(next);
  } else if (acc) {
    redirect(next || "/");
  }

  const boardMode = !!board && !!target && sp.with !== "account";
  const setupNeeded = !boardMode && !(await hasAnyAdmin());

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <LoginForm
        key={boardMode ? "board" : "account"}
        next={next}
        mode={boardMode ? "board" : "account"}
        target={target ?? "deck"}
        slug={board?.slug ?? ""}
        boardTitle={board?.title}
        streamerName={board?.streamerName}
        hasBoardSession={session.grants.length > 0 && !board}
        setupNeeded={setupNeeded}
        alreadySignedIn={!!acc}
      />
    </div>
  );
}
