import type { PrivacyDoc } from "./types";
import DataList from "./DataList";

const en: PrivacyDoc = {
  title: "Privacy & photo terms",
  onThisPage: "On this page",
  version: (v, date) => `Version ${v} · Updated ${date}`,
  contactLabel: "Contact",
  sections: ({ L, mail, del, report, controller, reportResolvedDays, reportMaxDays, auditDays }) => [
    { id: "summary", title: "In short", body: (
      <ul>
        <li>We only use what you send (form and photos) to review it and, if a moderator approves it, show it live.</li>
        <li>Your email is never shown on stream.</li>
        <li>The stream is public: once shown, copies made by others can&apos;t be fully removed.</li>
        <li>You can delete your submission at any time with your deletion code; otherwise it&apos;s deleted after {L.retentionDays} days.</li>
        <li>{L.minAge}+ only. No tracking, ads, data selling or AI training.</li>
      </ul>
    )},
    { id: "controller", title: "1. Who is responsible", body: <p>The data controller is {controller}.</p> },
    { id: "data", title: "2. What we process, why and for how long", body: (
      <>
        <DataList
          labels={{ what: "Data", why: "Purpose", basis: "Legal basis", kept: "Kept for" }}
          items={[
            {
              id: "submissions",
              title: "Your submission",
              what: <>Username, email, country, description, the board you chose and your photos (with location and camera data removed in your browser).</>,
              why: "Reviewing it and, if approved, showing it live. The email is only for contacting you about it.",
              basis: "Your consent (GDPR art. 6(1)(a)), which you can withdraw at any time.",
              kept: <><strong>{L.retentionDays} days</strong>, or until you or a moderator delete it. Incomplete uploads: 24 hours.</>,
            },
            {
              title: "Proof of consent",
              what: "Date and time, version of this policy and a one-way hash of your deletion code.",
              why: "Proving what you agreed to, and letting you delete your submission without an account.",
              basis: "Legal obligation to demonstrate consent (arts. 6(1)(c) and 7(1)).",
              kept: "As long as the submission.",
            },
            {
              id: "reports",
              title: "Problem reports",
              what: "Category, message, the page or board it came from, your language and, only if you give it, an email.",
              why: "Fixing faults, removing inappropriate content and, if you asked, replying.",
              basis: "Legitimate interest (art. 6(1)(f)); the reply, your consent.",
              kept: `${reportResolvedDays} days after it's resolved, never more than ${reportMaxDays} days.`,
            },
            {
              title: "Security",
              what: "Your IP address, stored only as a keyed one-way hash, and the browser signals checked by Cloudflare Turnstile.",
              why: "Stopping spam, bots and attacks (attempt limits and anti-bot check).",
              basis: "Legitimate interest in keeping the service secure (art. 6(1)(f)).",
              kept: "Attempt counters: 48 hours.",
            },
            {
              id: "staff",
              title: "Staff accounts and activity log",
              what: <>For administrators: username, role, a hash of the password, the encrypted two-step key and last sign-in. An <strong>activity log</strong> records who did what and when (sign-ins, approvals, deletions, changes to boards and accounts) with a pseudonymised connection identifier. It never includes senders&apos; details.</>,
              why: "Managing access, detecting misuse and being able to show how data was handled.",
              basis: "Legitimate interest and the duty to keep data secure (arts. 5(2), 6(1)(f) and 32).",
              kept: `Accounts: while the person is on the team. Activity log: ${auditDays} days; entries can't be changed.`,
            },
          ]}
        />
        <p>Please don&apos;t include anything revealing health, religion, political views, sexual orientation or similar (art. 9); if a photo shows it, we delete it or treat it as made public by you for this purpose. Moderation is done by people: no automated decisions or profiling.</p>
      </>
    )},
    { id: "photos", title: "3. Photo and broadcast terms", body: (
      <ul>
        <li>Only send photos you took or have rights to, and that you&apos;re allowed to share.</li>
        <li>No people in the photos, except on boards that allow it (such as costume reviews): there, only you or adults who agreed to appear. <strong>Never children.</strong></li>
        <li>You give {L.controllerName} and <strong>the streamer named on the board</strong> a free, non-exclusive licence, revocable at any time, to show the photos, username, country and description on <strong>that streamer&apos;s live streams</strong>, recordings and highlights. Nothing else: no sale, advertising, other publication or AI training.</li>
        <li>Moderators may reject, delete, blur or skip any photo to protect privacy.</li>
        <li>Anyone can watch, record and clip the stream. If you withdraw, we stop showing your photos and delete the recordings and clips we control where the platform allows; we can&apos;t delete copies made by others.</li>
      </ul>
    )},
    { id: "recipients", title: "4. Who can see your data", body: (
      <ul>
        <li><strong>The board&apos;s team</strong>: the admin who created it, admins it&apos;s shared with, and its Board Admins (moderators with the queue password). They see everything for that board only.</li>
        <li><strong>Site Admins</strong> (who run the site): all boards, problem reports and the activity log.</li>
        <li><strong>The streamer</strong>: approved photos, username, country and description of their board. Never your email.</li>
        <li><strong>The stream audience</strong>: the same, only once approved.</li>
        <li><strong>Providers</strong> working for us under data processing agreements: Supabase (database and photos, region {L.databaseRegion}), Vercel (hosting, short-lived technical logs) and Cloudflare (anti-bot check). Where they access data from the US, transfers are covered by the EU-U.S. Data Privacy Framework and/or Standard Contractual Clauses (arts. 45 and 46).</li>
        <li>Authorities, only if the law requires it.</li>
      </ul>
    )},
    { id: "rights", title: "5. Your rights", body: (
      <>
        <p>You can access, correct, delete, restrict or object to the use of your data, get a copy (portability) and withdraw consent.</p>
        <ul>
          <li><strong>Fastest:</strong> {del("delete your submission")} with your deletion code.</li>
          <li><strong>Anything else</strong> or a lost code: email {mail} from the address you used. We reply within one month.</li>
          <li>To flag a photo or content about you: {report("report a problem")}.</li>
          <li>You can complain to a data protection authority: in Spain the <a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, or the one where you live or work.</li>
        </ul>
        <p>These rights apply wherever you live (including the UK GDPR, Brazil&apos;s LGPD and US state laws such as the CCPA/CPRA). We don&apos;t sell or share personal data for advertising.</p>
      </>
    )},
    { id: "cookies", title: "6. Cookies", body: (
      <>
        <p>Only cookies that are strictly necessary or that you ask for, so there&apos;s no consent banner:</p>
        <ul>
          <li>Cloudflare Turnstile security cookies, on forms with the anti-bot check.</li>
          <li>Staff session (12 hours) and two-step sign-in step (5 minutes).</li>
          <li>Language (1 year), only if you choose one in the menu.</li>
        </ul>
        <p>Your colour theme is saved in your browser and never sent to us.</p>
      </>
    )},
    { id: "security", title: "7. Security", body: (
      <p>Photos are in private storage and only shown through temporary links. Only Site Admins can create staff accounts, which use strong hashed passwords and optional two-step verification. Each board has separate queue and deck passwords that can be regenerated at any time to revoke access. Traffic is encrypted (HTTPS), sign-ins are protected against bots and brute force, and only our server can reach the database.</p>
    )},
    { id: "minors", title: "8. Minimum age", body: (
      <p>You must be {L.minAge} or older to submit. If we learn that a submission comes from or shows a minor, we delete it.</p>
    )},
    { id: "changes", title: "9. Changes", body: (
      <p>If we change this policy, we update the version and date above. Each submission records the version that was accepted.</p>
    )},
  ],
};

export default en;
