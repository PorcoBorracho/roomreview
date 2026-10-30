import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { activeAccount, boardAccess, getSession, HOME_PANEL } from "@/lib/session";
import { getBoard } from "@/lib/boards";
import { hasAnyAdmin } from "@/lib/accounts";
import { twitchEnabled } from "@/lib/twitch";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).login.signIn, robots: { index: false } };
}

const BOARD_NEXT = /^\/([a-z0-9_]{1,40})\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(queue|deck)$/;
const ACCOUNT_NEXT = /^\/(?:panel|streamers|team|admins|problems|audit|account)?$/;
const TWITCH_NOTICES = ["pending", "suspended", "denied", "error", "reserved", "full", "off", "busy"] as const;
export type TwitchNotice = (typeof TWITCH_NOTICES)[number];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; with?: string; twitch?: string }> }) {
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "";
  const m = raw.match(BOARD_NEXT);
  const next = m || ACCOUNT_NEXT.test(raw) ? raw : "";
  const board = m ? await getBoard(m[1], m[2]) : null;
  const target = (m?.[3] ?? null) as "queue" | "deck" | null;
  const notice = (TWITCH_NOTICES as readonly string[]).includes(sp.twitch ?? "") ? (sp.twitch as TwitchNotice) : null;

  const session = await getSession();
  if (session.account?.mustChange) redirect("/account/password");
  if (session.account?.mustEnrollTotp) redirect("/account/2fa");
  const acc = activeAccount(session);

  // Si ya tiene permiso para ir adonde quería, no hace falta volver a entrar
  if (board && target) {
    const access = await boardAccess(board.id);
    if (target === "queue" ? access.moderate : access.view) redirect(next);
  } else if (acc) {
    redirect(next || HOME_PANEL);
  }

  const boardMode = !!board?.streamer && !!target && sp.with !== "account";
  const setupNeeded = !boardMode && !(await hasAnyAdmin());

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <LoginForm
        key={boardMode ? "board" : "account"}
        next={next}
        mode={boardMode ? "board" : "account"}
        target={target ?? "deck"}
        streamer={board?.streamer?.login ?? ""}
        slug={board?.slug ?? ""}
        boardTitle={board?.title}
        streamerName={board?.streamer?.displayName}
        hasBoardSession={session.grants.length > 0 && !board}
        setupNeeded={setupNeeded}
        alreadySignedIn={!!acc}
        twitch={twitchEnabled()}
        notice={notice}
      />
    </div>
  );
}
