import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = { title: `Privacy & photo terms · ${LEGAL.projectName}` };

type Section = { id: string; title: string; body: React.ReactNode };

const L = LEGAL;
const mail = <Link href="/contact">{L.contactEmail}</Link>;
const del = (t: string) => <Link href="/delete">{t}</Link>;
const controller = (
  <>
    <strong>{L.controllerName}</strong>
    {L.controllerTaxId ? <> ({L.controllerTaxId})</> : null}, {L.controllerAddress}. Contact: {mail}
  </>
);

const EN: Section[] = [
  { id: "summary", title: "In short", body: (
    <ul>
      <li>We collect only what you type in the form and the photos you upload, to review your submission and, if approved, show it on stream.</li>
      <li>Your email is never shown on stream. Your username, country, description and photos are shown <strong>only if a moderator approves them</strong>.</li>
      <li>The stream is public and can be recorded by viewers. Once shown, copies made by others can&apos;t be fully removed.</li>
      <li>You can delete your submission at any time with your deletion code. Everything is deleted automatically after {L.retentionDays} days.</li>
      <li>Only people aged {L.minAge}+ may submit. No tracking, no ads, no selling of data, no AI training.</li>
    </ul>
  )},
  { id: "controller", title: "1. Who is responsible", body: <p>The data controller is {controller}.</p> },
  { id: "data", title: "2. What data we process", body: (
    <ul>
      <li><strong>Form data:</strong> username, email address, country and description, and which board (for example &quot;Room Review&quot; or &quot;Pet Review&quot;) you submitted to.</li>
      <li><strong>Photos</strong> and anything visible in them. We re-encode them in your browser, which removes location and camera metadata (EXIF/GPS).</li>
      <li><strong>Consent record:</strong> date and time of your submission and the version of this policy you accepted.</li>
      <li><strong>Security data:</strong> your IP address is used to limit abuse. We only store it as a keyed one-way hash, and delete it within 48 hours. The anti-bot check (Cloudflare Turnstile) processes your IP address, browser and device signals.</li>
      <li><strong>Staff only:</strong> administrators and streamers who sign in get a session cookie.</li>
    </ul>
  )},
  { id: "purposes", title: "3. Why, and on what legal basis", body: (
    <ul>
      <li><strong>Reviewing your submission and showing it on stream</strong>: your consent (GDPR art. 6(1)(a)), given with the checkboxes in the form. You can withdraw it at any time; this doesn&apos;t affect what was done before.</li>
      <li><strong>Contacting you about your submission</strong> (email): your consent, as above.</li>
      <li><strong>Preventing spam, abuse and attacks</strong> (rate limits, anti-bot check): our legitimate interest in keeping the service secure (art. 6(1)(f)).</li>
      <li><strong>Sensitive data:</strong> we ask you not to include anything revealing health, religion, political views, sexual orientation or similar (art. 9). If a photo shows it anyway, we treat it as explicitly made public by you for this purpose, or we delete it.</li>
      <li>Moderation is done by people. There are no automated decisions or profiling.</li>
    </ul>
  )},
  { id: "photos", title: "4. Photo and broadcast terms", body: (
    <>
      <ul>
        <li>You confirm that you took the photos or own the rights to them, that you have permission to share what they show, and that they don&apos;t show children or other people&apos;s personal data.</li>
        <li>On most boards, photos must not show any people. On boards that allow people (such as costume reviews), photos may show you, and anyone else shown must be an adult who agreed to appear. Children are never allowed.</li>
        <li>You give {L.controllerName} and <strong>the streamer named on the board you submit to</strong> a <strong>free, non-exclusive licence</strong>, revocable at any time, to display the photos, username, country and description <strong>on that streamer&apos;s live streams</strong>, on the platform shown on the board, and in that channel&apos;s recordings and highlights.</li>
        <li>We will <strong>not</strong> sell them, use them in advertising, publish them anywhere else, or use them to train AI models.</li>
        <li>Moderators may reject or delete any submission, and may blur or skip any photo on stream to protect privacy.</li>
        <li><strong>Public broadcast:</strong> the stream can be watched, recorded, clipped and shared by anyone. If you withdraw, we stop showing your photos and delete the recordings and clips we control where the platform allows. We can&apos;t delete copies made by third parties.</li>
      </ul>
    </>
  )},
  { id: "recipients", title: "5. Who receives your data", body: (
    <>
      <ul>
        <li><strong>Administrators</strong> who review submissions (all form data and photos).</li>
        <li><strong>The streamer who runs the board</strong> you submit to: only approved photos, username, country and description, never your email. Each streamer only has access to their own boards.</li>
        <li><strong>The stream audience</strong> (only approved photos, username, country and description). Each board also has a public page with its title and description, but submissions are never listed there.</li>
        <li><strong>Service providers</strong> processing data on our behalf under data processing agreements:
          <ul>
            <li>Supabase Inc. (database and photo storage; region: {L.databaseRegion}).</li>
            <li>Vercel Inc. (website hosting; may keep short-lived technical logs that include IP addresses).</li>
            <li>Cloudflare Inc. (Turnstile anti-bot check; strictly necessary security cookies).</li>
          </ul>
        </li>
        <li>Authorities, only if required by law.</li>
      </ul>
    </>
  )},
  { id: "transfers", title: "6. International transfers", body: (
    <p>Some providers are based in the United States or may access data from there. These transfers are covered by the EU-U.S. Data Privacy Framework where the provider is certified, and/or the European Commission&apos;s Standard Contractual Clauses (GDPR arts. 45 and 46).</p>
  )},
  { id: "retention", title: "7. How long we keep it", body: (
    <ul>
      <li><strong>Submissions</strong> (data and photos): deleted automatically <strong>{L.retentionDays} days</strong> after submitting, or earlier if you delete it or a moderator removes it.</li>
      <li>Incomplete uploads: within 24 hours.</li>
      <li>Hashed IP rate-limit counters: within 48 hours.</li>
      <li>Staff session cookie: 12 hours.</li>
      <li>Stream recordings and clips: according to each channel&apos;s settings and the streaming platform&apos;s policy.</li>
    </ul>
  )},
  { id: "rights", title: "8. Your rights", body: (
    <>
      <p>You can access, correct, delete, restrict or object to the processing of your data, ask for a copy (portability), and withdraw consent at any time.</p>
      <ul>
        <li><strong>Fastest:</strong> {del("delete your submission")} with your deletion code.</li>
        <li><strong>Anything else</strong>, or if you lost the code: email {mail} from the address you used. We reply within one month.</li>
        <li>You can complain to a data protection authority: in Spain the <a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, or the authority where you live or work.</li>
      </ul>
      <p>We offer these rights to everyone, wherever you live, including under the UK GDPR, Brazil&apos;s LGPD and US state privacy laws such as California&apos;s CCPA/CPRA. We do not sell or share personal information for advertising.</p>
    </>
  )},
  { id: "minors", title: "9. Minimum age", body: (
    <p>You must be {L.minAge} or older to submit. Photos must never show children. If we learn that a submission comes from or shows a minor, we delete it.</p>
  )},
  { id: "cookies", title: "10. Cookies", body: (
    <p>We only use cookies that are strictly necessary: Cloudflare Turnstile security cookies on the submission form, and a session cookie for administrators and streamers who sign in. We use no analytics, advertising or tracking cookies, so no consent banner is needed.</p>
  )},
  { id: "security", title: "11. Security", body: (
    <p>Photos are kept in private storage and only shown through temporary links. Staff pages are password protected, each streamer has a separate password,, all traffic is encrypted (HTTPS), and access to the database is restricted to the server.</p>
  )},
  { id: "changes", title: "12. Changes", body: (
    <p>If we change this policy, we will update the version and date below. Each submission records the version accepted.</p>
  )},
];

export default function PrivacyPage() {
  const sections = EN;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:gap-16">
      <aside className="hidden lg:block">
        <nav aria-label="On this page" className="sticky top-24">
          <p className="text-xs font-semibold text-subtle">On this page</p>
          <ul className="mt-3 space-y-1 border-l border-line">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-[13px] text-muted hover:border-line-strong hover:text-white">
                  {s.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article className="max-w-[72ch]">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy & photo terms</h1>
        <p className="mt-2 text-sm text-subtle">Version {L.policyVersion} · Updated {L.policyUpdated}</p>

        <div className="legal mt-8 space-y-9">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
