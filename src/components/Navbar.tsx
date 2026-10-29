import Link from "next/link";
import { Video, LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { logout } from "@/actions/auth";
import NavLinks from "./NavLinks";

export default async function Navbar() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="pressable flex items-center gap-3 rounded-xl" aria-label="tokyogh0uul Room Review, home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent shadow-raised">
            <Video className="size-[18px]" strokeWidth={2.25} />
          </span>
          <span className="hidden leading-tight min-[480px]:block">
            <span className="block text-[15px] font-extrabold tracking-tight text-white">tokyogh0uul</span>
            <span className="block text-xs font-medium text-muted">Room Review</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <NavLinks role={session?.role ?? null} />
          {session && (
            <form action={logout}>
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="pressable flex size-9 items-center justify-center rounded-xl border border-line text-muted hover:border-line-strong hover:text-white"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
