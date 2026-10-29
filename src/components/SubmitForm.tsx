"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Clapperboard, X, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { initSubmission, finalizeSubmission } from "@/actions/submit";
import { processImage } from "@/lib/image-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Turnstile from "./Turnstile";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = "room-media";

type Picked = { id: string; blob: Blob; preview: string };

const inputCls =
  "w-full bg-[#0e0e13] border border-twitch-border rounded-xl py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-twitch-purple transition";

export default function SubmitForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Picked[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [dragging, setDragging] = useState(false);

  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.preview)), []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [success]);

  async function addFiles(list: FileList | File[]) {
    setError(null);
    const files = Array.from(list).slice(0, MAX_FILES - media.length);
    if (files.length === 0) return;
    const added: Picked[] = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(`Processing photo ${i + 1} of ${files.length}...`);
      try {
        const blob = await processImage(files[i]);
        if (blob.size > MAX_BYTES) throw new Error(`"${files[i].name}" is too large after compression`);
        added.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not process image");
      }
    }
    setBusy(null);
    setMedia((m) => [...m, ...added].slice(0, MAX_FILES));
  }

  function removeMedia(id: string) {
    setMedia((m) => {
      const item = m.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return m.filter((x) => x.id !== id);
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (media.length === 0) return setError("Please upload at least 1 photo of your room!");
    if (!token) return setError("Please complete the anti-bot check.");

    const fd = new FormData(e.currentTarget);
    try {
      setBusy("Preparing submission...");
      const init = await initSubmission({
        username: String(fd.get("username") ?? ""),
        email: String(fd.get("email") ?? ""),
        country: String(fd.get("country") ?? ""),
        description: String(fd.get("description") ?? ""),
        files: media.map((m) => ({ type: "image/jpeg", size: m.blob.size })),
        turnstileToken: token,
      });
      if (!init.ok) throw new Error(init.error);

      const storage = supabaseBrowser().storage.from(BUCKET);
      for (let i = 0; i < init.uploads.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${init.uploads.length}...`);
        const u = init.uploads[i];
        const { error: upErr } = await storage.uploadToSignedUrl(u.path, u.token, media[i].blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (upErr) throw new Error("Upload failed. Check your connection and try again.");
      }

      setBusy("Saving submission...");
      const fin = await finalizeSubmission(init.submissionId, init.finalizeToken);
      if (!fin.ok) throw new Error(fin.error);

      formRef.current?.reset();
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
      setToken("");
      setCaptchaKey((k) => k + 1); // los tokens de Turnstile son de un solo uso
    }
  }

  return (
    <>
      {success && (
        <div role="status" className="fixed bottom-6 right-6 z-50 bg-twitch-card border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-3 max-w-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-400">Submission Received!</h4>
            <p className="text-xs text-slate-300">Your room details and media have been privately submitted for review.</p>
          </div>
          <button onClick={() => setSuccess(false)} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 border-4 border-twitch-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-twitch-neon font-bold">{busy}</p>
        </div>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-300 mb-1.5">Username *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-xs">@</span>
              <input id="username" name="username" type="text" required maxLength={41} autoComplete="nickname"
                placeholder="username" className={`${inputCls} pl-8 pr-3 font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address *</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-500" />
              <input id="email" name="email" type="email" required maxLength={254} autoComplete="email"
                placeholder="your.email@example.com" className={`${inputCls} pl-9 pr-3 font-mono`} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="country" className="block text-xs font-semibold text-slate-300 mb-1.5">Country *</label>
            <input id="country" name="country" type="text" required maxLength={60} autoComplete="country-name"
              placeholder="e.g. United States, Portugal, Japan..." className={`${inputCls} px-3.5`} />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-slate-300 mb-1.5">Room Description *</label>
          <textarea id="description" name="description" required rows={4} maxLength={2000}
            placeholder="Describe your room, specs, lighting setup, or backstory..."
            className="w-full bg-[#0e0e13] border border-twitch-border rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-twitch-purple transition resize-none" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-xs font-semibold text-slate-300">Room Photos *</span>
            <span className="text-[11px] font-mono text-slate-400">{media.length} / {MAX_FILES} Media Selected</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => media.length < MAX_FILES && fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={`border-2 border-dashed ${dragging ? "border-twitch-purple" : "border-twitch-border"} hover:border-twitch-purple rounded-2xl p-6 text-center cursor-pointer transition bg-[#0e0e13] group`}
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-twitch-card flex items-center justify-center text-slate-400 group-hover:text-twitch-neon transition border border-twitch-border">
                <Clapperboard className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300"><span className="text-twitch-neon font-semibold underline">Click to select & upload</span></p>
              <p className="text-[11px] text-slate-500">Supports PNG, JPEG and WebP images (Max 5 total)</p>
              <p className="text-[11px] text-slate-500"><b>Upload times will vary depending on the file size. Please be patient while your photos are uploading.</b></p>
              <p className="text-[10px] text-slate-500"><b>Please be careful not to share any personal information that could reveal your identity or home address.</b></p>
              <p className="text-[10px] text-slate-500"><b>Be sure to censor any parts of the photos that show you, your family members, or any names.</b></p>
              <p className="text-[10px] text-slate-500">Location data (GPS/EXIF) is automatically removed from your photos.</p>
            </div>
          </div>

          {media.length > 0 && (
            <div className="grid grid-cols-5 gap-2.5 mt-3">
              {media.map((m) => (
                <div key={m.id} className="relative h-20 rounded-xl overflow-hidden border border-twitch-border bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeMedia(m.id)} aria-label="Remove photo"
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/80 text-white hover:bg-red-600 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Turnstile onToken={setToken} resetKey={captchaKey} />

        {error && (
          <p role="alert" className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <button type="submit" disabled={!!busy}
          className="w-full bg-gradient-to-r from-twitch-purple to-cyber-pink hover:opacity-95 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-[0.98] shadow-xl glow-purple flex items-center justify-center space-x-2">
          <Send className="w-4 h-4" />
          <span>Submit</span>
        </button>
        <p className="text-xs sm:text-sm text-slate-400 text-center">
          By submitting, you confirm that these are your photos and give permission for them to be featured on stream if approved.
        </p>
      </form>
    </>
  );
}
