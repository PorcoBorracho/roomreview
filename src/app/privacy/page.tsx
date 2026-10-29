import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = { title: "Privacy & photo terms · tokyogh0uul Room Review" };

type Lang = "en" | "es";
type Section = { id: string; title: string; body: React.ReactNode };

const L = LEGAL;
const mail = <a href={`mailto:${L.contactEmail}`}>{L.contactEmail}</a>;
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
      <li>We collect only what you type in the form and the photos you upload, to review your room and, if approved, show it on stream.</li>
      <li>Your email is never shown on stream. Your username, country, description and photos are shown <strong>only if a moderator approves them</strong>.</li>
      <li>The stream is public and can be recorded by viewers. Once shown, copies made by others can&apos;t be fully removed.</li>
      <li>You can delete your submission at any time with your deletion code. Everything is deleted automatically after {L.retentionDays} days.</li>
      <li>Only people aged {L.minAge}+ may submit. No tracking, no ads, no selling of data, no AI training.</li>
    </ul>
  )},
  { id: "controller", title: "1. Who is responsible", body: <p>The data controller is {controller}.</p> },
  { id: "data", title: "2. What data we process", body: (
    <ul>
      <li><strong>Form data:</strong> username, email address, country and room description.</li>
      <li><strong>Photos</strong> and anything visible in them. We re-encode them in your browser, which removes location and camera metadata (EXIF/GPS).</li>
      <li><strong>Consent record:</strong> date and time of your submission and the version of this policy you accepted.</li>
      <li><strong>Security data:</strong> your IP address is used to limit abuse. We only store it as a keyed one-way hash, and delete it within 48 hours. The anti-bot check (Cloudflare Turnstile) processes your IP address, browser and device signals.</li>
      <li><strong>Staff only:</strong> moderators who log in get a session cookie.</li>
    </ul>
  )},
  { id: "purposes", title: "3. Why, and on what legal basis", body: (
    <ul>
      <li><strong>Reviewing your room and showing it on stream</strong>: your consent (GDPR art. 6(1)(a)), given with the checkboxes in the form. You can withdraw it at any time; this doesn&apos;t affect what was done before.</li>
      <li><strong>Contacting you about your submission</strong> (email): your consent, as above.</li>
      <li><strong>Preventing spam, abuse and attacks</strong> (rate limits, anti-bot check): our legitimate interest in keeping the service secure (art. 6(1)(f)).</li>
      <li><strong>Sensitive data:</strong> we ask you not to include anything revealing health, religion, political views, sexual orientation or similar (art. 9). If a photo shows it anyway, we treat it as explicitly made public by you for this purpose, or we delete it.</li>
      <li>Moderation is done by people. There are no automated decisions or profiling.</li>
    </ul>
  )},
  { id: "photos", title: "4. Photo and broadcast terms", body: (
    <>
      <ul>
        <li>You confirm that you took the photos or own the rights to them, that you have permission to show the space, and that they don&apos;t show other people, children, or other people&apos;s personal data.</li>
        <li>You give {L.controllerName} a <strong>free, non-exclusive licence</strong>, revocable at any time, to display the photos, username, country and description <strong>on the {L.projectName} live streams on {L.broadcastPlatform}</strong> and in the recordings and highlights of that channel.</li>
        <li>We will <strong>not</strong> sell them, use them in advertising, publish them anywhere else, or use them to train AI models.</li>
        <li>Moderators may reject or delete any submission, and may blur or skip any photo on stream to protect privacy.</li>
        <li><strong>Public broadcast:</strong> the stream can be watched, recorded, clipped and shared by anyone. If you withdraw, we stop showing your photos and delete the recordings and clips we control where the platform allows. We can&apos;t delete copies made by third parties.</li>
      </ul>
    </>
  )},
  { id: "recipients", title: "5. Who receives your data", body: (
    <>
      <ul>
        <li><strong>Moderators</strong> of the channel (all form data and photos).</li>
        <li><strong>The stream audience</strong> (only approved photos, username, country and description).</li>
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
      <li>Moderator session cookie: 12 hours.</li>
      <li>Recordings on {L.broadcastPlatform}: according to the channel&apos;s settings and the platform&apos;s policy.</li>
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
    <p>We only use cookies that are strictly necessary: Cloudflare Turnstile security cookies on the submission form, and a session cookie for moderators who log in. We use no analytics, advertising or tracking cookies, so no consent banner is needed.</p>
  )},
  { id: "security", title: "11. Security", body: (
    <p>Photos are kept in private storage and only shown through temporary links. Moderator pages are password protected, all traffic is encrypted (HTTPS), and access to the database is restricted to the server.</p>
  )},
  { id: "changes", title: "12. Changes", body: (
    <p>If we change this policy, we will update the version and date below. Each submission records the version accepted.</p>
  )},
];

const ES: Section[] = [
  { id: "summary", title: "En resumen", body: (
    <ul>
      <li>Solo recogemos lo que escribes en el formulario y las fotos que subes, para revisar tu habitación y, si se aprueba, mostrarla en directo.</li>
      <li>Tu email nunca se muestra en directo. Tu usuario, país, descripción y fotos se muestran <strong>solo si un moderador los aprueba</strong>.</li>
      <li>El directo es público y los espectadores pueden grabarlo. Una vez emitido, no se pueden eliminar del todo las copias hechas por otras personas.</li>
      <li>Puedes borrar tu entrega cuando quieras con tu código de borrado. Todo se borra automáticamente a los {L.retentionDays} días.</li>
      <li>Solo pueden participar personas de {L.minAge} años o más. Sin rastreo, sin publicidad, sin venta de datos y sin entrenar IA.</li>
    </ul>
  )},
  { id: "controller", title: "1. Responsable del tratamiento", body: <p>El responsable del tratamiento es {controller}.</p> },
  { id: "data", title: "2. Qué datos tratamos", body: (
    <ul>
      <li><strong>Datos del formulario:</strong> nombre de usuario, email, país y descripción de la habitación.</li>
      <li><strong>Fotos</strong> y todo lo que aparezca en ellas. Se recodifican en tu navegador, lo que elimina los metadatos de ubicación y cámara (EXIF/GPS).</li>
      <li><strong>Registro del consentimiento:</strong> fecha y hora del envío y versión de esta política que aceptaste.</li>
      <li><strong>Datos de seguridad:</strong> tu IP se usa para limitar abusos. Solo se guarda como un hash irreversible con clave y se borra en un máximo de 48 horas. La verificación anti-bots (Cloudflare Turnstile) trata tu IP y datos del navegador y del dispositivo.</li>
      <li><strong>Solo personal:</strong> los moderadores que inician sesión reciben una cookie de sesión.</li>
    </ul>
  )},
  { id: "purposes", title: "3. Finalidades y base jurídica", body: (
    <ul>
      <li><strong>Revisar tu habitación y mostrarla en directo</strong>: tu consentimiento (art. 6.1.a RGPD), otorgado con las casillas del formulario. Puedes retirarlo en cualquier momento sin que afecte a lo realizado antes.</li>
      <li><strong>Contactarte sobre tu entrega</strong> (email): tu consentimiento, como arriba.</li>
      <li><strong>Prevenir spam, abusos y ataques</strong> (límites de peticiones y verificación anti-bots): nuestro interés legítimo en mantener seguro el servicio (art. 6.1.f).</li>
      <li><strong>Datos sensibles:</strong> te pedimos que no incluyas nada que revele salud, religión, ideas políticas, orientación sexual o similares (art. 9). Si una foto lo muestra igualmente, se entiende que lo has hecho público expresamente para esta finalidad, o la borramos.</li>
      <li>La moderación la hacen personas. No hay decisiones automatizadas ni elaboración de perfiles.</li>
    </ul>
  )},
  { id: "photos", title: "4. Condiciones de las fotos y la emisión", body: (
    <ul>
      <li>Confirmas que las fotos son tuyas o tienes sus derechos, que tienes permiso para mostrar ese espacio, y que no aparecen otras personas, menores ni datos personales de terceros.</li>
      <li>Concedes a {L.controllerName} una <strong>licencia gratuita, no exclusiva</strong> y revocable en cualquier momento para mostrar las fotos, tu usuario, país y descripción <strong>en los directos de {L.projectName} en {L.broadcastPlatform}</strong>, y en las grabaciones y clips de ese canal.</li>
      <li><strong>No</strong> las venderemos, ni las usaremos en publicidad, ni las publicaremos en otro sitio, ni las usaremos para entrenar modelos de IA.</li>
      <li>Los moderadores pueden rechazar o borrar cualquier entrega, y difuminar u omitir cualquier foto en directo para proteger la privacidad.</li>
      <li><strong>Emisión pública:</strong> cualquiera puede ver, grabar, recortar y compartir el directo. Si retiras tu consentimiento, dejamos de mostrar tus fotos y borramos las grabaciones y clips que controlamos cuando la plataforma lo permita. No podemos borrar copias hechas por terceros.</li>
    </ul>
  )},
  { id: "recipients", title: "5. Destinatarios", body: (
    <ul>
      <li><strong>Los moderadores</strong> del canal (todos los datos y fotos).</li>
      <li><strong>El público del directo</strong> (solo fotos aprobadas, usuario, país y descripción).</li>
      <li><strong>Proveedores</strong> que tratan datos por cuenta nuestra con contrato de encargo de tratamiento:
        <ul>
          <li>Supabase Inc. (base de datos y almacenamiento de fotos; región: {L.databaseRegion}).</li>
          <li>Vercel Inc. (alojamiento web; puede guardar registros técnicos breves que incluyen direcciones IP).</li>
          <li>Cloudflare Inc. (verificación anti-bots Turnstile; cookies de seguridad estrictamente necesarias).</li>
        </ul>
      </li>
      <li>Autoridades, solo si lo exige la ley.</li>
    </ul>
  )},
  { id: "transfers", title: "6. Transferencias internacionales", body: (
    <p>Algunos proveedores tienen sede en Estados Unidos o pueden acceder a datos desde allí. Estas transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. cuando el proveedor está certificado y/o en las Cláusulas Contractuales Tipo de la Comisión Europea (arts. 45 y 46 RGPD).</p>
  )},
  { id: "retention", title: "7. Plazo de conservación", body: (
    <ul>
      <li><strong>Entregas</strong> (datos y fotos): se borran automáticamente <strong>{L.retentionDays} días</strong> después del envío, o antes si las borras tú o un moderador.</li>
      <li>Subidas incompletas: en 24 horas.</li>
      <li>Contadores anti-abuso con IP cifrada: en 48 horas.</li>
      <li>Cookie de sesión de moderadores: 12 horas.</li>
      <li>Grabaciones en {L.broadcastPlatform}: según la configuración del canal y la política de la plataforma.</li>
    </ul>
  )},
  { id: "rights", title: "8. Tus derechos", body: (
    <>
      <p>Puedes acceder, rectificar, suprimir, limitar u oponerte al tratamiento de tus datos, pedir una copia (portabilidad) y retirar tu consentimiento en cualquier momento.</p>
      <ul>
        <li><strong>Lo más rápido:</strong> {del("borrar tu entrega")} con tu código de borrado.</li>
        <li><strong>Para lo demás</strong>, o si perdiste el código: escribe a {mail} desde el email que usaste. Respondemos en un plazo máximo de un mes.</li>
        <li>Puedes reclamar ante una autoridad de protección de datos: en España, la <a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, o la del lugar donde vives o trabajas.</li>
      </ul>
      <p>Ofrecemos estos derechos a todo el mundo, vivas donde vivas, incluido el RGPD del Reino Unido, la LGPD de Brasil y las leyes estatales de EE. UU. como la CCPA/CPRA de California. No vendemos ni compartimos datos personales con fines publicitarios.</p>
    </>
  )},
  { id: "minors", title: "9. Edad mínima", body: (
    <p>Debes tener {L.minAge} años o más para participar. Las fotos nunca deben mostrar a menores. Si sabemos que una entrega procede de un menor o lo muestra, la borramos.</p>
  )},
  { id: "cookies", title: "10. Cookies", body: (
    <p>Solo usamos cookies estrictamente necesarias: las de seguridad de Cloudflare Turnstile en el formulario de envío y una cookie de sesión para los moderadores. No usamos cookies de analítica, publicidad ni rastreo, por lo que no hace falta banner de consentimiento.</p>
  )},
  { id: "security", title: "11. Seguridad", body: (
    <p>Las fotos se guardan en un almacenamiento privado y solo se muestran mediante enlaces temporales. Las páginas de moderación están protegidas con contraseña, todo el tráfico va cifrado (HTTPS) y el acceso a la base de datos está restringido al servidor.</p>
  )},
  { id: "changes", title: "12. Cambios", body: (
    <p>Si cambiamos esta política, actualizaremos la versión y la fecha de abajo. Cada entrega registra la versión aceptada.</p>
  )},
];

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang: Lang = (await searchParams).lang === "es" ? "es" : "en";
  const sections = lang === "es" ? ES : EN;

  return (
    <article className="mx-auto max-w-[72ch]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            {lang === "es" ? "Privacidad y condiciones de las fotos" : "Privacy & photo terms"}
          </h2>
          <p className="mt-2 text-sm text-subtle">
            {lang === "es" ? "Versión" : "Version"} {L.policyVersion} · {lang === "es" ? "Actualizada" : "Updated"} {L.policyUpdated}
          </p>
        </div>
        <nav aria-label="Language" className="flex rounded-xl border border-line bg-well p-1 text-[13px] font-semibold">
          <Link href="/privacy" aria-current={lang === "en" ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 ${lang === "en" ? "bg-raised text-white" : "text-muted hover:text-white"}`}>English</Link>
          <Link href="/privacy?lang=es" aria-current={lang === "es" ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 ${lang === "es" ? "bg-raised text-white" : "text-muted hover:text-white"}`}>Español</Link>
        </nav>
      </div>

      <div className="legal mt-8 space-y-9">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h3>{s.title}</h3>
            {s.body}
          </section>
        ))}
      </div>
    </article>
  );
}
