import Link from "next/link";
import { Video, LogOut, ChevronRight } from "lucide-react";
import { logout } from "@/actions/auth";
import { LEGAL } from "@/config/legal";
import type { Session } from "@/lib/session";
import type { BoardInfo } from "@/lib/types";
import HeaderShell from "./HeaderShell";
import BoardNav from "./BoardNav";
import { Pill } from "./Pill";
import ThemeToggle from "./ThemeToggle";

type Props = { session: Session | null; board?: BoardInfo; staff?: boolean };

/** Cabecera única: marca, migas de pan, navegación del board y sesión, en la misma retícula que el contenido. */
export default function AppHeader({ session, board, staff = false }: Props) {
  const admin = session?.role === "admin";
  const mark = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent shadow-raised">
      <Video className="size-[18px]" strokeWidth={2.25} />
    </span>
  );

  return (
    <HeaderShell>
      <div className="shell flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {admin ? (
            <Link href="/" className="pressable rounded-xl" aria-label="Control panel">{mark}</Link>
          ) : mark}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {admin ? (
              <Link href="/" className="shrink-0 font-semibold text-muted hover:text-strong">{board ? "Boards" : LEGAL.projectName}</Link>
            ) : (
              <span className="shrink-0 font-semibold text-muted">{board?.streamerName || LEGAL.projectName}</span>
            )}
            {board && staff && (
              <>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />
                <span className="truncate font-semibold text-strong">{board.title}</span>
                {!board.isActive && <Pill tone="muted">Inactive</Pill>}
                {board.isActive && !board.submissionsOpen && <Pill tone="warning">Closed</Pill>}
              </>
            )}
            {!board && admin && (
              <>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />
                <span className="truncate font-semibold text-strong">Control panel</span>
              </>
            )}
          </nav>
        </div>

        {board && staff && (
          <div className="order-last w-full sm:order-none sm:w-auto">
            <BoardNav slug={board.slug} admin={admin} />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
        {session && (
          <>
            <span className="hidden rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-muted md:inline">
              {admin ? "Admin" : "Streamer"}
            </span>
            <form action={logout}>
              <button type="submit" aria-label="Log out" title="Log out"
                className="pressable flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
                <LogOut className="size-4" /> <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </>
        )}
        </div>
      </div>
    </HeaderShell>
  );
}
