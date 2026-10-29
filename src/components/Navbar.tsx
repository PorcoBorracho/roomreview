import Link from "next/link";
import { Video, LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { logout } from "@/actions/auth";
import NavLinks from "./NavLinks";

export default async function Navbar() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-40 bg-[#0d0d12]/90 backdrop-blur-md border-b border-twitch-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-twitch-purple to-cyber-cyan rounded-xl blur opacity-70 group-hover:opacity-100 transition" />
              <div className="relative w-10 h-10 rounded-xl bg-twitch-card border border-twitch-purple flex items-center justify-center text-twitch-neon">
                <Video className="w-5 h-5" />
              </div>
            </div>
            <div className="hidden min-[420px]:block">
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-twitch-neon bg-clip-text text-transparent">
                tokyogh0uul
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">Room Review</p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <NavLinks role={session?.role ?? null} />
            {session && (
              <form action={logout}>
                <button
                  type="submit"
                  title="Log out"
                  className="p-2 rounded-xl text-slate-400 hover:text-white bg-twitch-card border border-twitch-border transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
