import Link from "next/link";
import { Video, LogOut, ChevronRight } from "lucide-react";
import { logout } from "@/actions/auth";
import { LEGAL } from "@/config/legal";
import { activeAccount, boardAccess, displayRole, getSession, HOME_PANEL, isSiteAdmin } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BoardInfo, StreamerRef } from "@/lib/types";
import { getT } from "@/i18n/server";
import HeaderShell from "./HeaderShell";
import BoardNav from "./BoardNav";
import PanelNav from "./PanelNav";
import { Pill } from "./Pill";
import ThemeToggle from "./ThemeToggle";
import LanguageSelect from "./LanguageSelect";
import SignInLink from "./SignInLink";

/** Contadores de las pestañas del panel: problemas abiertos y streamers esperando aprobación */
async function panelCounts(): Promise<{ problems: number; pendingStreamers: number }> {
  const db = supabaseAdmin();
  const [p, s] = await Promise.all([
    db.from("problem_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("admins").select("id", { count: "exact", head: true }).eq("role", "streamer").eq("status", "pending"),
  ]);
  return { problems: p.count ?? 0, pendingStreamers: s.count ?? 0 };
}

const crumb = "min-w-0 truncate font-semibold text-muted hover:text-strong";

/**
 * Cabecera única: marca, migas de pan, navegación (del board o del panel) y sesión, en la misma retícula que el contenido.
 * board → página de un board; streamer → página pública de un streamer; ninguno → resto de la web.
 */
export default async function AppHeader({ board, streamer }: { board?: BoardInfo; streamer?: StreamerRef }) {
  const t = await getT();
  const session = await getSession();
  const acc = activeAccount(session);
  const access = board ? await boardAccess(board.id) : null;
  const staff = !!access?.view;
  const role = await displayRole(board?.id);
  const signedIn = !!session.account || session.grants.length > 0;
  const siteAdmin = isSiteAdmin(acc);
  const counts = siteAdmin && !board && !streamer ? await panelCounts() : { problems: 0, pendingStreamers: 0 };
  const owner = board?.streamer ?? streamer ?? null;
  const base = board?.streamer ? `/${board.streamer.login}/${board.slug}` : null;

  const mark = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent shadow-raised">
      <Video className="size-[18px]" strokeWidth={2.25} />
    </span>
  );

  return (
    <HeaderShell>
      <div className="shell flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={acc ? HOME_PANEL : "/"} className="pressable rounded-xl" aria-label={acc ? t.header.controlPanel : LEGAL.projectName}>{mark}</Link>
          <nav aria-label={t.header.breadcrumb} className="flex min-w-0 items-center gap-1.5 text-sm">
            {owner ? (
              <>
                {/* En el móvil, dentro de un board del equipo se omite el streamer para que quepa el título */}
                <Link href={`/${owner.login}`} className={`${crumb} ${board && staff ? "hidden sm:inline" : ""}`}>{owner.displayName}</Link>
                {board && (
                  <>
                    <ChevronRight aria-hidden className={`size-4 shrink-0 text-subtle ${staff ? "hidden sm:block" : ""}`} />
                    <span className="truncate font-semibold text-strong">{board.title}</span>
                    {staff && !board.isActive && <Pill tone="muted">{t.status.inactive}</Pill>}
                    {staff && board.isActive && !board.submissionsOpen && <Pill tone="warning">{t.status.closed}</Pill>}
                  </>
                )}
              </>
            ) : (
              <Link href={acc ? HOME_PANEL : "/"} className={crumb}>{LEGAL.projectName}</Link>
            )}
          </nav>
        </div>

        {board && staff && access && base && (
          <div className="order-last w-full sm:order-none sm:w-auto">
            <BoardNav base={base} queue={access.moderate} deck={access.view} />
          </div>
        )}
        {!board && !streamer && acc && (
          <div className="order-last w-full empty:hidden sm:order-none sm:w-auto">
            <PanelNav role={acc.role} siteAdmin={siteAdmin} openProblems={counts.problems} pendingStreamers={counts.pendingStreamers} />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelect />
          <ThemeToggle />
          {signedIn ? (
            <>
              {role && (
                <span className="hidden max-w-[16rem] truncate rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-muted lg:inline">
                  {acc ? `${acc.displayName} · ${t.header.roles[role]}` : t.header.roles[role]}
                </span>
              )}
              <form action={logout}>
                <button type="submit" aria-label={t.header.logOut} title={t.header.logOut}
                  className="pressable flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-raised hover:text-strong">
                  <LogOut className="size-4" /> <span className="hidden sm:inline">{t.header.logOut}</span>
                </button>
              </form>
            </>
          ) : !board && <SignInLink />}
        </div>
      </div>
    </HeaderShell>
  );
}
