"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, Search, Inbox, Mail, Check, Trash2, Undo2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { approveSubmission, deleteSubmission, unapproveSubmission } from "@/actions/admin";
import type { AdminSubmission } from "@/lib/types";
import Lightbox from "./Lightbox";

type Props = {
  submissions: AdminSubmission[];
  filtered: number;
  total: number;
  status: "pending" | "approved" | "all";
  q: string;
  page: number;
  pageSize: number;
};

export default function AdminQueue({ submissions, filtered, total, status, q, page, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function go(params: { status?: string; q?: string; page?: number }) {
    const sp = new URLSearchParams();
    const s = params.status ?? status;
    const query = params.q ?? search;
    if (s !== "pending") sp.set("status", s);
    if (query.trim()) sp.set("q", query.trim());
    if ((params.page ?? 1) > 1) sp.set("page", String(params.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => go({ q: search, page: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function run(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.error ?? "Action failed");
      setBusyId(null);
      router.refresh();
    });
  }

  const pages = Math.max(1, Math.ceil(filtered / pageSize));
  const offset = (page - 1) * pageSize;

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-twitch-card p-5 rounded-2xl border border-twitch-border">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyber-yellow" /> Admin Approval Queue
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-twitch-purple/20 text-twitch-neon border border-twitch-purple/30">
              Viewing {filtered} of {total} Submissions
            </span>
          </div>
          <p className="text-xs text-slate-400">Approve or delete pending room review submissions.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60}
              placeholder="Search username or country..."
              className="w-full bg-[#0e0e13] border border-twitch-border text-xs rounded-xl pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-twitch-purple" />
          </div>
          <select value={status} onChange={(e) => go({ status: e.target.value, page: 1 })}
            className="bg-[#0e0e13] border border-twitch-border text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-twitch-purple">
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="all">All Submissions</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {submissions.length === 0 ? (
        <div className="text-center py-16 bg-twitch-card/40 rounded-2xl border border-dashed border-twitch-border">
          <Inbox className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-slate-300">No Submissions Found</h3>
          <p className="text-xs text-slate-500 mt-1">There are currently no submissions matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub, index) => {
            const approved = sub.status === "approved";
            const busy = busyId === sub.id;
            return (
              <div key={sub.id} className={`bg-twitch-card border border-twitch-border p-5 rounded-2xl space-y-4 shadow-xl ${busy ? "opacity-60" : ""}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-twitch-border/60">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-[#0e0e13] border border-twitch-purple/40 text-twitch-neon font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      #{offset + index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white font-mono truncate">@{sub.username}</h3>
                        <span className="text-xs text-slate-300 shrink-0">• {sub.country}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                        <span className="text-[11px] font-mono text-cyber-cyan flex items-center gap-1 break-all">
                          <Mail className="w-3 h-3 shrink-0" /> {sub.email}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[10px] font-mono text-slate-500">Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                    {approved ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Approved</span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Pending Approval</span>
                    )}
                    {approved ? (
                      <button disabled={busy} onClick={() => run(sub.id, unapproveSubmission)} title="Move back to pending"
                        className="px-3 py-1.5 bg-[#0e0e13] hover:bg-twitch-border text-slate-300 border border-twitch-border rounded-xl text-xs font-bold transition flex items-center gap-1">
                        <Undo2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => run(sub.id, approveSubmission)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                    )}
                    <button disabled={busy}
                      onClick={() => { if (window.confirm(`Delete @${sub.username}'s submission permanently?`)) run(sub.id, deleteSubmission); }}
                      className="px-3.5 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-[#0e0e13] p-3 rounded-xl border border-twitch-border/60 whitespace-pre-line break-words">
                  “{sub.description}”
                </p>

                <div>
                  <span className="text-[11px] font-mono text-slate-400 block mb-2">Attached Server Media ({sub.media.length} items):</span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {sub.media.map((m) => (
                      <button key={m.id} type="button" onClick={() => setLightbox(m.url)}
                        className="relative h-20 rounded-xl overflow-hidden border border-twitch-border bg-black hover:opacity-80 transition">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs font-mono text-slate-400">
          <button disabled={page <= 1} onClick={() => go({ page: page - 1 })}
            className="p-2 rounded-lg bg-twitch-card border border-twitch-border disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span>Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => go({ page: page + 1 })}
            className="p-2 rounded-lg bg-twitch-card border border-twitch-border disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
