"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";

export default function LoginForm({ role, next }: { role: "admin" | "viewer"; next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="bg-twitch-card border border-twitch-border p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-twitch-purple/20 border border-twitch-purple/40 text-twitch-neon flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">{role === "admin" ? "Admin Verification" : "Streamer Deck Access"}</h3>
        <p className="text-xs text-slate-400">Please enter password to unlock.</p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="password" className="sr-only">Password</label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" maxLength={256}
            placeholder="Enter password"
            className="w-full bg-[#0e0e13] border border-twitch-border rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-twitch-purple font-mono" />
          {state.error && <p role="alert" className="text-[11px] text-red-400 mt-1.5 text-center font-mono">{state.error}</p>}
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/" className="w-1/2 py-2.5 border border-twitch-border bg-[#0e0e13] hover:bg-twitch-border text-slate-300 rounded-xl text-xs font-semibold transition text-center">
            Cancel
          </Link>
          <button type="submit" disabled={pending}
            className="w-1/2 py-2.5 bg-twitch-purple hover:bg-twitch-neon disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg glow-purple">
            {pending ? "Checking..." : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
