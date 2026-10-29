import Link from "next/link";
import { Video, LogOut, ChevronRight } from "lucide-react";
import { logout } from "@/actions/auth";
import { LEGAL } from "@/config/legal";
import { activeAccount, boardAccess, displayRole, getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BoardInfo } from "@/lib/types";
import { getT } from "@/i18n/server";
import HeaderShell from "./HeaderShell";
import BoardNav from "./BoardNav";
import PanelNav from "./PanelNav";
import { Pill } from "./Pill";
import ThemeToggle from "./ThemeToggle";
import LanguageSelect from "./LanguageSelect";

async function openProblemCount(): Promise<number> {
  const { count } = await supabaseAdmin().from("problem_reports").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

/** Cabecera única: marca, migas de pan, navegación (del board o del panel) y sesión, en la misma retícula que el contenido. */
export default async function AppHeader({ board }: { board?: BoardInfo }) {
  const t = await getT();
  const session = await getSession();
  const acc = activeAccount(session);
  const access = board ? await boardAccess(board.id) : null;
  const staff = !!access?.view;
  const role = await displayRole(board?.id);
  const signedIn = !!session.account || session.grants.length > 0;
  const siteAdmin = acc?.role === "site_admin";
  const openProblems = siteAdmin && !board ? await openProblemCount() : 0;

  const mark = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent shadow-raised">
      <Video className="size-[18px]" strokeWidth={2.25} />
    </span>
  );

  return (
    <HeaderShell>
      <div className="shell flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {acc ? (
            <Link href="/" className="pressable rounded-xl" aria-label={t.header.controlPanel}>{mark}</Link>
          ) : mark}
          <nav aria-label={t.header.breadcrumb} className="flex min-w-0 items-center gap-1.5 text-sm">
            {/* En el móvil, dentro de un board se omite el primer nivel para que quepa el título */}
            {acc ? (
              <Link href="/" className={`min-w-0 truncate font-semibold text-muted hover:text-strong ${board && staff ? "hidden sm:inline" : ""}`}>
                {board ? t.header.boards : LEGAL.projectName}
              </Link>
            ) : (
              <span className={`min-w-0 truncate font-semibold text-muted ${board && staff ? "hidden sm:inline" : ""}`}>{board?.streamerName || LEGAL.projectName}</span>
            )}
            {board && staff && (
              <>
                <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-subtle sm:block" />
                <span className="truncate font-semibold text-strong">{board.title}</span>
                {!board.isActive && <Pill tone="muted">{t.status.inactive}</Pill>}
                {board.isActive && !board.submissionsOpen && <Pill tone="warning">{t.status.closed}</Pill>}
              </>
            )}
          </nav>
        </div>

        {board && staff && access && (
          <div className="order-last w-full sm:order-none sm:w-auto">
            <BoardNav slug={board.slug} queue={access.moderate} deck={access.view} />
          </div>
        )}
        {!board && acc && (
          <div className="order-last w-full empty:hidden sm:order-none sm:w-auto">
            <PanelNav siteAdmin={siteAdmin} openProblems={openProblems} />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelect />
          <ThemeToggle />
          {signedIn && (
            <>
              {role && (
                <span className="hidden rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-muted lg:inline">
                  {acc ? `${acc.username} · ${t.header.roles[role]}` : t.header.roles[role]}
                </span>
              )}
              <form action={logout}>
                <button type="submit" aria-label={t.header.logOut} title={t.header.logOut}
                  className="pressable flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
                  <LogOut className="size-4" /> <span className="hidden sm:inline">{t.header.logOut}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}
