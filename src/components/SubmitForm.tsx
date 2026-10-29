"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, ImagePlus, X, Send, AlertCircle, ShieldAlert, Loader2, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { initSubmission, finalizeSubmission } from "@/actions/submit";
import { ImageError, processImage } from "@/lib/image-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Turnstile from "./Turnstile";
import SubmissionReceipt from "./SubmissionReceipt";
import { LEGAL } from "@/config/legal";
import type { Platform } from "@/lib/platforms";
import { useT } from "@/i18n/client";
import type { Dict } from "@/i18n/dict";
import FormError from "./FormError";
import { BUCKET, MAX_DESCRIPTION as MAX_DESC, MAX_FILES, MAX_FILE_BYTES as MAX_BYTES } from "@/lib/limits";

type Picked = { id: string; blob: Blob; preview: string };
type Progress = { label: string; done: number; total: number };
/** Error: clave del diccionario (de errors) o texto ya traducido */
type Err = { key: string } | { text: string } | null;
type Consents = { age: boolean; thirdParties: boolean; broadcast: boolean; privacy: boolean };
const NO_CONSENTS: Consents = { age: false, thirdParties: false, broadcast: false, privacy: false };

export default function SubmitForm({ boardId, peopleAllowed, streamerName, platform }: {
  boardId: string; peopleAllowed: boolean; streamerName: string; platform: Platform;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Picked[]>([]);
  const [processing, setProcessing] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<Err>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [descLen, setDescLen] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<Err>(null);
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
    if (all.length > files.length) setError({ text: t.form.tooManyPhotos(MAX_FILES) });
    if (files.length === 0) return;

    setProcessing((n) => n + files.length);
    for (const file of files) {
      try {
        const blob = await processImage(file);
        if (blob.size > MAX_BYTES) throw new ImageError("tooDetailed", file.name);
        const item = { id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) };
        setMedia((m) => [...m, item].slice(0, MAX_FILES));
      } catch (e) {
        setError({ text: imageErrorText(t, e) });
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
    if (processing > 0) return setError({ text: t.form.waitProcessing });
    if (media.length === 0) return setError({ text: t.form.addPhoto });
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
    if (!allConsents) return setReviewError({ text: t.review.tickAll });
    if (!token) return setReviewError({ text: t.review.verifyFirst });

    const fd = new FormData(form);
    try {
      const total = media.length + 2;
      setProgress({ label: t.review.preparing, done: 0, total });
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
      if (!init.ok) throw new KeyError(init.error);

      const storage = supabaseBrowser().storage.from(BUCKET);
      for (let i = 0; i < init.uploads.length; i++) {
        setProgress({ label: t.review.uploading(i + 1, init.uploads.length), done: i + 1, total });
        const u = init.uploads[i];
        const { error: upErr } = await storage.uploadToSignedUrl(u.path, u.token, media[i].blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (upErr) throw new TextError(t.review.uploadFailed);
      }

      setProgress({ label: t.review.saving, done: total - 1, total });
      const fin = await finalizeSubmission(init.submissionId, init.finalizeToken);
      if (!fin.ok) throw new KeyError(fin.error);

      form.reset();
      setDescLen(0);
      media.forEach((m) => URL.revokeObjectURL(m.preview));
      setMedia([]);
      setConsents(NO_CONSENTS);
      setReviewOpen(false);
      setReceipt(init.deletionCode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setReviewError(err instanceof KeyError ? { key: err.message } : err instanceof TextError ? { text: err.message } : { text: t.common.somethingWrong });
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
          <Field label={t.form.username} htmlFor="username">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-hint">@</span>
              <input id="username" name="username" type="text" required maxLength={41} autoComplete="nickname"
                autoCapitalize="off" spellCheck={false} placeholder="yourname" className="field pl-8" />
            </div>
          </Field>
          <Field label={t.form.email} htmlFor="email" hint={t.form.emailHint}>
            <div className="relative">
              <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-hint" />
              <input id="email" name="email" type="email" required maxLength={254} autoComplete="email"
                inputMode="email" placeholder="you@example.com" className="field pl-10" />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.form.country} htmlFor="country">
              <input id="country" name="country" type="text" required maxLength={60} autoComplete="country-name"
                placeholder={t.form.countryPlaceholder} className="field" />
            </Field>
          </div>
        </div>

        <Field
          label={t.form.description}
          htmlFor="description"
          aside={<span className={`tabular-nums ${descLen > MAX_DESC - 100 ? "text-warning-text" : "text-subtle"}`}>{descLen}/{MAX_DESC}</span>}
        >
          <textarea id="description" name="description" required rows={4} maxLength={MAX_DESC}
            onChange={(e) => setDescLen(e.target.value.length)}
            placeholder={t.form.descriptionPlaceholder}
            className="field min-h-28 resize-y" />
        </Field>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span id="photos-label" className="text-sm font-medium text-ink">{t.form.photos}</span>
            <span className="text-xs tabular-nums text-subtle">{t.form.photosCount(media.length, MAX_FILES)}</span>
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
              <span className="text-sm font-medium text-muted">{t.form.photoLimit}</span>
            ) : (
              <span className="text-sm text-muted">
                <span className="font-semibold text-accent-text">{t.form.choosePhotos}</span> {t.form.orDrag}
              </span>
            )}
            <span id="photos-help" className="text-xs text-subtle">{t.form.photoTypes(MAX_FILES)}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

          {(media.length > 0 || processing > 0) && (
            <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {media.map((m, i) => (
                <li key={m.id} className="enter-zoom group relative aspect-square overflow-hidden rounded-xl border border-line bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt={t.form.photoAlt(i + 1)} className="size-full object-cover" />
                  <button type="button" onClick={() => removeMedia(m.id)} aria-label={t.form.removePhoto(i + 1)}
                    className="pressable absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm hover:bg-danger">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {Array.from({ length: processing }).map((_, i) => (
                <li key={`p${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-line bg-well" aria-label={t.form.processingPhoto}>
                  <Loader2 className="size-5 animate-spin text-subtle" />
                </li>
              ))}
            </ul>
          )}

            <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
              <span>{t.form.quickCheck(peopleAllowed)}</span>
            </p>
          </div>

        <ErrorBox error={error} />

        <div className="space-y-3">
          <button type="submit" disabled={processing > 0}
            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent shadow-raised hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/60">
            {t.form.reviewAndSubmit} <ArrowRight className="size-4" />
          </button>
          <p className="text-center text-xs leading-relaxed text-subtle">
            {t.form.nothingSentYet(LEGAL.retentionDays)}
          </p>
        </div>
      </fieldset>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => { if (!submitting) setReviewOpen(false); }}
        summary={summary}
        peopleAllowed={peopleAllowed}
        where={t.streamPhrase(streamerName.trim(), platform === "other" ? null : t.platforms[platform])}
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

class KeyError extends Error {}
class TextError extends Error {}

function imageErrorText(t: Dict, e: unknown): string {
  if (e instanceof ImageError) {
    const m = t.form.imageErrors;
    if (e.code === "unreadable") return m.unreadable(e.fileName);
    if (e.code === "tooDetailed") return m.tooDetailed(e.fileName);
    return m[e.code];
  }
  return t.form.imageErrors.failed;
}

function ErrorBox({ error }: { error: Err }) {
  if (!error) return null;
  return (
    <div className="enter-fade rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
      {"key" in error ? <FormError code={error.key} /> : (
        <p role="alert" className="flex items-start gap-2.5 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error.text}
        </p>
      )}
    </div>
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
  const t = useT();
  const g = t.guidelines;
  const B = ({ children }: { children: React.ReactNode }) => <strong className="font-medium text-ink">{children}</strong>;
  return (
    <details className="group rounded-xl border border-line bg-well open:pb-1" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        <ShieldAlert className="size-4 shrink-0 text-warning-text" />
        <span className="flex-1">{g.title}</span>
        <span className="text-xs text-subtle group-open:hidden">{t.common.show}</span>
        <span className="hidden text-xs text-subtle group-open:inline">{t.common.hide}</span>
      </summary>
      <div className="space-y-4 px-4 pb-4 text-[13px] leading-relaxed text-muted">
        <div>
          <p className="font-medium text-ink">{g.removeIntro}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle">
            <li><B>{g.people}</B> {peopleAllowed ? g.peopleAllowedText : g.peopleText} <B>{g.neverChildren}</B></li>
            <li><B>{g.names}</B> {g.namesText}</li>
            <li><B>{g.documents}</B> {g.documentsText}</li>
            <li><B>{g.screens}</B> {g.screensText}</li>
            <li><B>{g.location}</B> {g.locationText}</li>
            <li><B>{g.sensitive}</B> {g.sensitiveText}</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink">{g.goodToKnow}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle">
            <li>{g.ownPhotos}</li>
            <li>{g.exifRemoved}</li>
            <li>{g.publicBroadcast}</li>
            <li>{g.deletionCode}</li>
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
  /** "PixelWitch's Twitch streams", ya traducido */
  where: string;
  media: Picked[];
  consents: Consents;
  setConsent: (k: keyof Consents, v: boolean) => void;
  onToken: (t: string) => void;
  captchaKey: number;
  error: Err;
  progress: Progress | null;
  canSend: boolean;
  onSend: () => void;
};

function ReviewDialog({ open, onClose, summary, peopleAllowed, where, media, consents, setConsent, onToken, captchaKey, error, progress, canSend, onSend }: DialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const link = "font-medium text-accent-text underline underline-offset-4";
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
              <h3 id="review-title" className="text-lg font-semibold text-strong">{t.review.title}</h3>
              <p className="mt-0.5 truncate text-sm text-muted">
                {t.review.summary(summary.username, summary.country, media.length)}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={sending} aria-label={t.review.backToEdit}
              className="pressable -m-1 rounded-lg p-1.5 text-subtle hover:text-strong disabled:opacity-40">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <ul className="flex gap-2 overflow-x-auto" aria-label={t.review.yourPhotos}>
              {media.map((m, i) => (
                <li key={m.id} className="size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt={t.form.photoAlt(i + 1)} className="size-full object-cover" />
                </li>
              ))}
            </ul>

            <PhotoGuidelines peopleAllowed={peopleAllowed} />

            <BasicInfo where={where} />

            <fieldset className="space-y-3" disabled={sending}>
              <legend className="mb-3 text-sm font-medium text-ink">{t.review.pleaseConfirm}</legend>
              <Consent name="consent_age" checked={consents.age} onChange={(v) => setConsent("age", v)}>
                {t.consent.age(LEGAL.minAge)}
              </Consent>
              <Consent name="consent_third_parties" checked={consents.thirdParties} onChange={(v) => setConsent("thirdParties", v)}>
                {peopleAllowed ? t.consent.peopleAllowed : t.consent.noPeople}
              </Consent>
              <Consent name="consent_broadcast" checked={consents.broadcast} onChange={(v) => setConsent("broadcast", v)}>
                {t.consent.broadcast(where, <Link href="/privacy#photos" target="_blank" className={link}>{t.consent.photoTerms}</Link>)}
              </Consent>
              <Consent name="consent_privacy" checked={consents.privacy} onChange={(v) => setConsent("privacy", v)}>
                {t.consent.privacy(<Link href="/privacy" target="_blank" className={link}>{t.consent.privacyPolicy}</Link>)}
              </Consent>
            </fieldset>

            {/* El captcha solo se carga en este paso: Cloudflare no recibe nada de quien no llega a enviar */}
            <Turnstile onToken={onToken} resetKey={captchaKey} />
          </div>

          <footer className="space-y-3 border-t border-line bg-panel px-5 py-4 sm:px-6">
            <ErrorBox error={error} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={onClose} disabled={sending}
                className="pressable flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-5 text-sm font-semibold text-muted hover:border-line-strong hover:text-strong disabled:opacity-40">
                <ArrowLeft className="size-4" /> {t.review.backToEdit}
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
                  <><Send className="size-4" /> {t.review.send}</>
                )}
              </button>
            </div>
            {!canSend && !sending && (
              <p className="text-center text-xs text-subtle">{t.review.sendHint}</p>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}

/** Primera capa informativa (art. 13 RGPD + art. 11 LOPDGDD), justo antes de enviar los datos. */
function BasicInfo({ where }: { where: string }) {
  const t = useT();
  const b = t.basicInfo;
  const link = "text-accent-text underline underline-offset-4";
  const rows: [string, React.ReactNode][] = [
    [b.controller, <>{LEGAL.controllerName} · <Link href="/contact" target="_blank" className={link}>{b.contact}</Link></>],
    [b.purpose, b.purposeText(where)],
    [b.legalBasis, b.legalBasisText],
    [b.recipients, b.recipientsText],
    [b.retention, b.retentionText(LEGAL.retentionDays)],
    [b.rights, b.rightsText],
  ];
  return (
    <section aria-labelledby="basic-info" className="rounded-xl border border-line">
      <h4 id="basic-info" className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-medium text-ink">
        <Info className="size-4 text-accent-text" /> {b.title}
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
        {b.fullDetails}{" "}
        <Link href="/privacy" target="_blank" className={`font-medium ${link}`}>{t.consent.privacyPolicy}</Link>
      </p>
    </section>
  );
}
