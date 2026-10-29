"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, ImagePlus, X, Send, AlertCircle, ShieldAlert, Loader2, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { initSubmission, finalizeSubmission } from "@/actions/submit";
import { processImage } from "@/lib/image-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Turnstile from "./Turnstile";
import SubmissionReceipt from "./SubmissionReceipt";
import { LEGAL } from "@/config/legal";
import { streamPhrase, type Platform } from "@/lib/platforms";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DESC = 2000;
const BUCKET = "room-media";

type Picked = { id: string; blob: Blob; preview: string };
type Progress = { label: string; done: number; total: number };
type Consents = { age: boolean; thirdParties: boolean; broadcast: boolean; privacy: boolean };
const NO_CONSENTS: Consents = { age: false, thirdParties: false, broadcast: false, privacy: false };

export default function SubmitForm({ boardId, peopleAllowed, streamerName, platform }: {
  boardId: string; peopleAllowed: boolean; streamerName: string; platform: Platform;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Picked[]>([]);
  const [processing, setProcessing] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [descLen, setDescLen] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ username: "", country: "" });
  const [consents, setConsents] = useState<Consents>(NO_CONSENTS);
  const allConsents = Object.values(consents).every(Boolean);

  const submitting = progress !== null;
  const slotsLeft = MAX_FILES - media.length - processing;
  const full = slotsLeft <= 0;

  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.preview)), []);


  async function addFiles(list: FileList | File[]) {
    setError(null);
    const all = Array.from(list);
    const files = all.slice(0, Math.max(0, slotsLeft));
    if (all.length > files.length) setError(`You can add up to ${MAX_FILES} photos. Extra files were skipped.`);
    if (files.length === 0) return;

    setProcessing((n) => n + files.length);
    for (const file of files) {
      try {
        const blob = await processImage(file);
        if (blob.size > MAX_BYTES) throw new Error(`"${file.name}" is too large, even after compression.`);
        const item = { id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) };
        setMedia((m) => [...m, item].slice(0, MAX_FILES));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That image couldn't be read.");
      } finally {
        setProcessing((n) => n - 1);
      }
    }
  }

  function removeMedia(id: string) {
    setMedia((m) => {
      const item = m.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return m.filter((x) => x.id !== id);
    });
  }

  /** Paso 1: el botón principal solo valida y abre la revisión. Aún no se envía nada. */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (processing > 0) return setError("Wait for your photos to finish processing.");
    if (media.length === 0) return setError("Add at least one photo of your room.");
    const fd = new FormData(e.currentTarget);
    setSummary({ username: String(fd.get("username") ?? "").replace(/^@+/, ""), country: String(fd.get("country") ?? "") });
    setReviewError(null);
    setReviewOpen(true);
  }

  /** Paso 2: tras leer los avisos y aceptar, se envían los datos. */
  async function send() {
    const form = formRef.current;
    if (!form) return;
    setReviewError(null);
    if (!allConsents) return setReviewError("Tick all four boxes to continue.");
    if (!token) return setReviewError("Complete the verification check first.");

    const fd = new FormData(form);
    try {
      const total = media.length + 2;
      setProgress({ label: "Preparing…", done: 0, total });
      const init = await initSubmission({
        boardId,
        username: String(fd.get("username") ?? ""),
        email: String(fd.get("email") ?? ""),
        country: String(fd.get("country") ?? ""),
        description: String(fd.get("description") ?? ""),
        files: media.map((m) => ({ type: "image/jpeg", size: m.blob.size })),
        turnstileToken: token,
        consents,
      });
      if (!init.ok) throw new Error(init.error);

      const storage = supabaseBrowser().storage.from(BUCKET);
      for (let i = 0; i < init.uploads.length; i++) {
        setProgress({ label: `Uploading photo ${i + 1} of ${init.uploads.length}…`, done: i + 1, total });
        const u = init.uploads[i];
        const { error: upErr } = await storage.uploadToSignedUrl(u.path, u.token, media[i].blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (upErr) throw new Error("A photo failed to upload. Check your connection and try again.");
      }

      setProgress({ label: "Saving…", done: total - 1, total });
      const fin = await finalizeSubmission(init.submissionId, init.finalizeToken);
      if (!fin.ok) throw new Error(fin.error);

      form.reset();
      setDescLen(0);
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      setConsents(NO_CONSENTS);
      setReviewOpen(false);
      setReceipt(init.deletionCode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setProgress(null);
      setToken("");
      setCaptchaKey((k) => k + 1); // los tokens de Turnstile son de un solo uso
    }
  }

  if (receipt) return <SubmissionReceipt code={receipt} onDone={() => setReceipt(null)} />;

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <fieldset disabled={submitting} className="space-y-6 disabled:opacity-100">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Username" htmlFor="username">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-hint">@</span>
              <input id="username" name="username" type="text" required maxLength={41} autoComplete="nickname"
                autoCapitalize="off" spellCheck={false} placeholder="yourname" className="field pl-8" />
            </div>
          </Field>
          <Field label="Email" htmlFor="email" hint="Only seen by moderators, never shown on stream.">
            <div className="relative">
              <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-hint" />
              <input id="email" name="email" type="email" required maxLength={254} autoComplete="email"
                inputMode="email" placeholder="you@example.com" className="field pl-10" />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Country" htmlFor="country">
              <input id="country" name="country" type="text" required maxLength={60} autoComplete="country-name"
                placeholder="Spain, Japan, Brazil…" className="field" />
            </Field>
          </div>
        </div>

        <Field
          label="Description"
          htmlFor="description"
          aside={<span className={`tabular-nums ${descLen > MAX_DESC - 100 ? "text-warning-text" : "text-subtle"}`}>{descLen}/{MAX_DESC}</span>}
        >
          <textarea id="description" name="description" required rows={4} maxLength={MAX_DESC}
            onChange={(e) => setDescLen(e.target.value.length)}
            placeholder="Tell us about it: what we're looking at, the story behind it…"
            className="field min-h-28 resize-y" />
        </Field>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span id="photos-label" className="text-sm font-medium text-ink">Photos</span>
            <span className="text-xs tabular-nums text-subtle">{media.length} of {MAX_FILES}</span>
          </div>

          <button
            type="button"
            aria-labelledby="photos-label"
            aria-describedby="photos-help"
            disabled={full || submitting}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!full) addFiles(e.dataTransfer.files); }}
            className={`group flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors duration-150 disabled:cursor-not-allowed ${
              dragging
                ? "border-accent bg-accent/10"
                : "border-line-strong bg-well hover:border-accent/70 hover:bg-accent/[0.04] disabled:hover:border-line-strong disabled:hover:bg-well"
            }`}
          >
            <span className={`flex size-11 items-center justify-center rounded-full border transition-colors duration-150 ${
              dragging ? "border-accent text-accent-text" : "border-line text-muted group-hover:text-accent-text group-disabled:text-subtle"}`}>
              <ImagePlus className="size-5" />
            </span>
            {full ? (
              <span className="text-sm font-medium text-muted">Photo limit reached. Remove one to add another.</span>
            ) : (
              <span className="text-sm text-muted">
                <span className="font-semibold text-accent-text">Choose photos</span> or drag them here
              </span>
            )}
            <span id="photos-help" className="text-xs text-subtle">JPEG, PNG or WebP · up to {MAX_FILES} photos</span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

          {(media.length > 0 || processing > 0) && (
            <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {media.map((m, i) => (
                <li key={m.id} className="enter-zoom group relative aspect-square overflow-hidden rounded-xl border border-line bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                  <button type="button" onClick={() => removeMedia(m.id)} aria-label={`Remove photo ${i + 1}`}
                    className="pressable absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm hover:bg-danger">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {Array.from({ length: processing }).map((_, i) => (
                <li key={`p${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-line bg-well" aria-label="Processing photo">
                  <Loader2 className="size-5 animate-spin text-subtle" />
                </li>
              ))}
            </ul>
          )}

            <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
              <span>Make sure no {peopleAllowed ? <>children, bystanders, </> : <>people, </>}<strong className="font-medium text-ink">names, addresses, documents or screens</strong> are visible. You&apos;ll see the full checklist before sending.</span>
            </p>
          </div>

        {error && (
          <p role="alert" className="enter-fade flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger-text">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger-text" /> {error}
          </p>
        )}

        <div className="space-y-3">
          <button type="submit" disabled={processing > 0}
            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/60">
            Review and submit <ArrowRight className="size-4" />
          </button>
          <p className="text-center text-xs leading-relaxed text-subtle">
            Nothing is sent until you confirm on the next step. Submissions are deleted automatically after {LEGAL.retentionDays} days.
          </p>
        </div>
      </fieldset>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => { if (!submitting) setReviewOpen(false); }}
        summary={summary}
        peopleAllowed={peopleAllowed}
        where={streamPhrase(streamerName, platform)}
        media={media}
        consents={consents}
        setConsent={(k, v) => setConsents((c) => ({ ...c, [k]: v }))}
        onToken={setToken}
        captchaKey={captchaKey}
        error={reviewError}
        progress={progress}
        canSend={allConsents && !!token}
        onSend={send}
      />
    </form>
  );
}

function Field({ label, htmlFor, hint, aside, children }: {
  label: string; htmlFor: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
        {aside && <span className="text-xs">{aside}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Consent({ name, checked, onChange, children }: {
  name: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-well px-3.5 py-3 text-[13px] leading-relaxed text-muted transition-colors duration-150 hover:border-line-strong has-[:checked]:border-accent/60 has-[:checked]:bg-accent/[0.06]">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-[var(--color-accent)]" />
      <span>{children}</span>
    </label>
  );
}

function PhotoGuidelines({ peopleAllowed }: { peopleAllowed: boolean }) {
  return (
    <details className="group rounded-xl border border-line bg-well open:pb-1" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        <ShieldAlert className="size-4 shrink-0 text-warning-text" />
        <span className="flex-1">Last check: is anything personal visible in your photos?</span>
        <span className="text-xs text-subtle group-open:hidden">Show</span>
        <span className="hidden text-xs text-subtle group-open:inline">Hide</span>
      </summary>
      <div className="space-y-4 px-4 pb-4 text-[13px] leading-relaxed text-muted">
        <div>
          <p className="font-medium text-ink">If any photo shows one of these, go back and replace, crop or blur it</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle">
            {peopleAllowed ? (
              <li><strong className="font-medium text-ink">People:</strong> only you, or adults who agreed to appear. Remove bystanders, people in the background, in mirrors or on screens. <strong className="font-medium text-ink">Never include children.</strong></li>
            ) : (
              <li><strong className="font-medium text-ink">People:</strong> faces or bodies of you, family, flatmates or anyone else, including in photos, frames, posters, mirrors and screen reflections. <strong className="font-medium text-ink">Never include children.</strong></li>
            )}
            <li><strong className="font-medium text-ink">Names and addresses:</strong> letters, parcels and labels, diplomas, name tags, house numbers, keys with tags.</li>
            <li><strong className="font-medium text-ink">Documents and cards:</strong> ID, bank cards, tickets, prescriptions, contracts, anything with a QR code or barcode.</li>
            <li><strong className="font-medium text-ink">Screens:</strong> monitors, phones and TVs showing accounts, chats, emails, notifications or passwords. Turn them off or show a neutral wallpaper.</li>
            <li><strong className="font-medium text-ink">Location clues:</strong> views from windows, street signs, landmarks, car number plates, router or Wi-Fi stickers.</li>
            <li><strong className="font-medium text-ink">Sensitive information:</strong> anything revealing health (medication, medical devices), religion, political views, sexual orientation or other private beliefs, unless you&apos;re comfortable sharing it publicly.</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">Good to know</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle">
            <li>Only upload photos you took yourself, or that you have permission to share.</li>
            <li>Location and camera data (GPS/EXIF) is removed from your photos automatically, but nothing else is changed.</li>
            <li>If approved, your photos are shown <strong className="font-medium text-ink">live to a public audience</strong>. Viewers may record or clip the stream, and copies made by others can&apos;t be fully removed.</li>
            <li>After sending you get a <strong className="font-medium text-ink">deletion code</strong> to remove your submission at any time.</li>
          </ul>
        </div>
      </div>
    </details>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  summary: { username: string; country: string };
  peopleAllowed: boolean;
  /** "tokyo's Twitch streams" */
  where: string;
  media: Picked[];
  consents: Consents;
  setConsent: (k: keyof Consents, v: boolean) => void;
  onToken: (t: string) => void;
  captchaKey: number;
  error: string | null;
  progress: Progress | null;
  canSend: boolean;
  onSend: () => void;
};

function ReviewDialog({ open, onClose, summary, peopleAllowed, where, media, consents, setConsent, onToken, captchaKey, error, progress, canSend, onSend }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const sending = progress !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.scrollTop = 0;
      document.body.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="review-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="review-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-float"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h3 id="review-title" className="text-lg font-semibold text-white">Review and send</h3>
              <p className="mt-0.5 truncate text-sm text-muted">
                @{summary.username} · {summary.country} · {media.length} {media.length === 1 ? "photo" : "photos"}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={sending} aria-label="Back to edit"
              className="pressable -m-1 rounded-lg p-1.5 text-subtle hover:text-white disabled:opacity-40">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <ul className="flex gap-2 overflow-x-auto" aria-label="Your photos">
              {media.map((m, i) => (
                <li key={m.id} className="size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                </li>
              ))}
            </ul>

            <PhotoGuidelines peopleAllowed={peopleAllowed} />

            <BasicInfo where={where} />

            <fieldset className="space-y-3" disabled={sending}>
              <legend className="mb-3 text-sm font-medium text-ink">Please confirm</legend>
              <Consent name="consent_age" checked={consents.age} onChange={(v) => setConsent("age", v)}>
                I am <strong className="font-semibold text-ink">{LEGAL.minAge} or older</strong>.
              </Consent>
              <Consent name="consent_third_parties" checked={consents.thirdParties} onChange={(v) => setConsent("thirdParties", v)}>
                {peopleAllowed ? (
                  <>Anyone shown is <strong className="font-semibold text-ink">me, or has agreed to appear</strong>.{" "}
                  <strong className="font-semibold text-ink">No children</strong> appear, and no names, addresses, documents or other
                  personal or sensitive information are visible.</>
                ) : (
                  <>My photos don&apos;t show <strong className="font-semibold text-ink">people or children</strong> (including me),
                  names, addresses, documents or other personal or sensitive information.</>
                )}
              </Consent>
              <Consent name="consent_broadcast" checked={consents.broadcast} onChange={(v) => setConsent("broadcast", v)}>
                I took these photos or own the rights to them, and I agree they may be shown{" "}
                <strong className="font-semibold text-ink">live on {where}</strong> together with my username,
                country and description. I understand the stream is public and may be recorded or clipped.{" "}
                <Link href="/privacy#photos" target="_blank" className="font-medium text-accent-text underline underline-offset-4">Photo terms</Link>
              </Consent>
              <Consent name="consent_privacy" checked={consents.privacy} onChange={(v) => setConsent("privacy", v)}>
                I have read the{" "}
                <Link href="/privacy" target="_blank" className="font-medium text-accent-text underline underline-offset-4">privacy policy</Link>{" "}
                and agree to my data being processed to review my submission. I can withdraw at any time by deleting my submission.
              </Consent>
            </fieldset>

            {/* El captcha solo se carga en este paso: Cloudflare no recibe nada de quien no llega a enviar */}
            <Turnstile onToken={onToken} resetKey={captchaKey} />
          </div>

          <footer className="space-y-3 border-t border-line bg-panel px-5 py-4 sm:px-6">
            {error && (
              <p role="alert" className="enter-fade flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger-text">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={onClose} disabled={sending}
                className="pressable flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-5 text-sm font-semibold text-muted hover:border-line-strong hover:text-white disabled:opacity-40">
                <ArrowLeft className="size-4" /> Back to edit
              </button>
              <button type="button" onClick={onSend} disabled={!canSend || sending}
                className="pressable relative flex h-12 shrink-0 items-center sm:flex-1 justify-center gap-2 overflow-hidden rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/45 disabled:text-on-accent/70">
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span aria-live="polite">{progress.label}</span>
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                      <span className="block h-full origin-left bg-white/70 transition-transform duration-300 ease-out"
                        style={{ transform: `scaleX(${(progress.done + 0.5) / progress.total})` }} />
                    </span>
                  </>
                ) : (
                  <><Send className="size-4" /> Send submission</>
                )}
              </button>
            </div>
            {!canSend && !sending && (
              <p className="text-center text-xs text-subtle">Tick all four boxes and complete the verification to send.</p>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}

/** Primera capa informativa (art. 13 RGPD + art. 11 LOPDGDD), justo antes de enviar los datos. */
function BasicInfo({ where }: { where: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Controller", <>{LEGAL.controllerName} · <Link href="/contact" target="_blank" className="text-accent-text underline underline-offset-4">Contact</Link></>],
    ["Purpose", `Review your submission and, if approved, show it live on ${where}.`],
    ["Legal basis", "Your consent (below). Anti-abuse checks: legitimate interest."],
    ["Recipients", <>The streamer running this board and moderators; the stream audience (approved photos, username, country and description only); service providers Supabase, Vercel and Cloudflare, with US transfers under EU safeguards.</>],
    ["Retention", `Deleted automatically after ${LEGAL.retentionDays} days, or sooner if you delete it.`],
    ["Your rights", "Access, correction, deletion, objection, portability and withdrawing consent. Use your deletion code or email us. You can complain to a data protection authority."],
  ];
  return (
    <section aria-labelledby="basic-info" className="rounded-xl border border-line">
      <h4 id="basic-info" className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-medium text-ink">
        <Info className="size-4 text-accent-text" /> How your data is used
      </h4>
      <dl className="divide-y divide-line text-[13px] leading-relaxed">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
            <dt className="font-medium text-subtle">{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">
        Full details:{" "}
        <Link href="/privacy" target="_blank" className="font-medium text-accent-text underline underline-offset-4">privacy policy</Link>
      </p>
    </section>
  );
}
