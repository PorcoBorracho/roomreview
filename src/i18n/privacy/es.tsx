import type { PrivacyDoc } from "./types";
import DataList from "./DataList";

const es: PrivacyDoc = {
  title: "Privacidad y condiciones de las fotos",
  onThisPage: "En esta página",
  version: (v, date) => `Versión ${v} · Actualizada el ${date}`,
  contactLabel: "Contacto",
  sections: ({ L, mail, del, report, controller, reportResolvedDays, reportMaxDays, auditDays }) => [
    { id: "summary", title: "En resumen", body: (
      <ul>
        <li>Solo usamos lo que envías (formulario, fotos y, en los boards que lo permiten, un vídeo) para revisarlo y, si un moderador lo aprueba, mostrarlo en directo.</li>
        <li>Tu email nunca se muestra en el directo.</li>
        <li>El directo es público: una vez mostrado, no se pueden eliminar del todo las copias que hagan otros.</li>
        <li>Puedes borrar tu envío cuando quieras con tu código de borrado; si no, se borra a los {L.retentionDays} días.</li>
        <li>Solo mayores de {L.minAge} años. Sin seguimiento, anuncios, venta de datos ni entrenamiento de IA.</li>
      </ul>
    )},
    { id: "controller", title: "1. Responsable", body: <p>El responsable del tratamiento es {controller}.</p> },
    { id: "data", title: "2. Qué datos tratamos, para qué y durante cuánto tiempo", body: (
      <>
        <DataList
          labels={{ what: "Datos", why: "Finalidad", basis: "Base legal", kept: "Plazo" }}
          items={[
            {
              id: "submissions",
              title: "Tu envío",
              what: <>Usuario, email, país, descripción, el board elegido, tus fotos y, en los boards que lo permiten, un vídeo. Los datos de ubicación y de la cámara se eliminan en tu navegador; los vídeos, además, se comprimen ahí y se envían sin sonido.</>,
              why: "Revisarlo y, si se aprueba, mostrarlo en directo. El email solo sirve para contactarte sobre el envío.",
              basis: "Tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento.",
              kept: <><strong>{L.retentionDays} días</strong>, o hasta que lo borres tú o un moderador. Subidas incompletas: 24 horas.</>,
            },
            {
              title: "Prueba del consentimiento",
              what: "Fecha y hora, versión de esta política y un hash irreversible de tu código de borrado.",
              why: "Demostrar qué aceptaste y permitirte borrar tu envío sin cuenta.",
              basis: "Obligación legal de poder demostrar el consentimiento (arts. 6.1.c y 7.1).",
              kept: "Lo mismo que el envío.",
            },
            {
              id: "reports",
              title: "Reportes de problemas",
              what: "Categoría, mensaje, la página o el board desde el que se envía, tu idioma y, solo si lo indicas, un email.",
              why: "Corregir fallos, retirar contenido inapropiado y, si lo pediste, responderte.",
              basis: "Interés legítimo (art. 6.1.f); la respuesta, tu consentimiento.",
              kept: `${reportResolvedDays} días después de resolverse, y nunca más de ${reportMaxDays} días.`,
            },
            {
              title: "Seguridad",
              what: "Tu dirección IP, guardada solo como un hash irreversible con clave, y las señales del navegador que comprueba Cloudflare Turnstile.",
              why: "Frenar spam, bots y ataques (límites de intentos y verificación anti-bots).",
              basis: "Interés legítimo en mantener el servicio seguro (art. 6.1.f).",
              kept: "Contadores de intentos: 48 horas.",
            },
            {
              id: "streamers",
              title: "Cuentas de streamer (Twitch)",
              what: <>Solo de los streamers: tu ID de usuario, login y nombre de Twitch, el enlace a tu imagen de perfil, el estado de tu cuenta y las fechas de acceso, y los Admins de tu equipo. No recibimos tu email ni tu contraseña de Twitch, y no guardamos ningún token de Twitch.</>,
              why: "Confirmar que eres el streamer, mostrar tu página pública y tus boards, y gestionar quién puede ayudarte.",
              basis: "Prestar el servicio que pides (art. 6.1.b) y nuestro interés legítimo en evitar suplantaciones (art. 6.1.f).",
              kept: "Mientras exista tu cuenta. Las solicitudes que no se aprueban se borran a los 30 días.",
            },
            {
              id: "staff",
              title: "Cuentas del equipo y registro de actividad",
              what: <>De los administradores: usuario, rol, un hash de la contraseña, la clave cifrada del 2FA y el último inicio de sesión. Un <strong>registro de actividad</strong> anota quién hizo qué y cuándo (inicios de sesión, aprobaciones, borrados, cambios en boards y cuentas) con un identificador de conexión seudonimizado. Nunca incluye datos de quien envía.</>,
              why: "Gestionar los accesos, detectar usos indebidos y poder demostrar cómo se han tratado los datos.",
              basis: "Interés legítimo y deber de mantener los datos seguros (arts. 5.2, 6.1.f y 32).",
              kept: `Cuentas: mientras la persona forme parte del equipo. Registro de actividad: ${auditDays} días; las entradas no se pueden modificar.`,
            },
          ]}
        />
        <p>No incluyas nada que revele salud, religión, opiniones políticas, orientación sexual o similares (art. 9); si una foto lo muestra, la borramos o lo consideramos hecho público por ti para esta finalidad. La moderación la hacen personas: no hay decisiones automatizadas ni perfiles.</p>
      </>
    )},
    { id: "photos", title: "3. Condiciones de las fotos y la emisión", body: (
      <ul>
        <li>Envía solo fotos que hayas hecho o sobre las que tengas derechos, y que tengas permiso para compartir.</li>
        <li>Sin personas en las fotos, salvo en los boards que lo permiten (como reviews de cosplay): ahí, solo tú o adultos que hayan aceptado salir. <strong>Nunca menores.</strong></li>
        <li>Concedes a {L.controllerName} y <strong>al streamer indicado en el board</strong> una licencia gratuita, no exclusiva y revocable en cualquier momento para mostrar las fotos y el vídeo, el usuario, el país y la descripción en <strong>los directos de ese streamer</strong>, sus grabaciones y destacados. Nada más: ni venta, ni publicidad, ni otras publicaciones, ni entrenamiento de IA.</li>
        <li>Los moderadores pueden rechazar, borrar, difuminar o saltar cualquier foto para proteger la privacidad.</li>
        <li>Cualquiera puede ver, grabar y recortar el directo. Si retiras el consentimiento, dejamos de mostrar tus fotos y borramos las grabaciones y clips que controlamos cuando la plataforma lo permite; no podemos borrar copias hechas por otros.</li>
      </ul>
    )},
    { id: "recipients", title: "4. Quién puede ver tus datos", body: (
      <ul>
        <li><strong>El equipo del board</strong>: el equipo del streamer (hasta dos Admins que elige), el admin que creó el board, los admins con quien se comparta y sus Board Admins (moderadores con la contraseña de la cola). Ven todo, pero solo de ese board.</li>
        <li><strong>Los Site Admins</strong> (gestionan la web): todos los boards, los reportes y el registro de actividad.</li>
        <li><strong>El streamer</strong>: fotos y vídeos aprobados, usuario, país y descripción de su board. Nunca tu email. Los streamers no ven la cola.</li>
        <li><strong>La audiencia del directo</strong>: lo mismo, y solo cuando se aprueba.</li>
        <li><strong>Cualquiera</strong>, solo en el caso de los streamers: tu página pública muestra tu nombre de Twitch, tu imagen de perfil y tus boards activos, y se te puede encontrar en el buscador.</li>
        <li><strong>Twitch</strong> (Twitch Interactive, Inc.), solo cuando un streamer entra con Twitch: Twitch gestiona ese acceso según su propia política de privacidad y nos dice quién eres.</li>
        <li><strong>Proveedores</strong> que trabajan para nosotros con contrato de encargado del tratamiento: Supabase (base de datos y fotos, región {L.databaseRegion}), Vercel (alojamiento, registros técnicos de corta duración) y Cloudflare (verificación anti-bots). Cuando acceden desde EE. UU., las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. y/o en cláusulas contractuales tipo (arts. 45 y 46).</li>
        <li>Autoridades, solo si la ley lo exige.</li>
      </ul>
    )},
    { id: "rights", title: "5. Tus derechos", body: (
      <>
        <p>Puedes acceder a tus datos, rectificarlos, suprimirlos, limitar u oponerte a su uso, pedir una copia (portabilidad) y retirar el consentimiento.</p>
        <ul>
          <li><strong>Lo más rápido:</strong> {del("borrar tu envío")} con tu código de borrado.</li>
          <li><strong>Cualquier otra cosa</strong> o si perdiste el código: escribe a {mail} desde el email que usaste. Respondemos en un mes como máximo.</li>
          <li>Para avisar de una foto o un contenido sobre ti: {report("reportar un problema")}.</li>
          <li>Puedes reclamar ante una autoridad de protección de datos: en España la <a href={L.authorityUrl} target="_blank" rel="noreferrer">{L.authorityName}</a>, o la del lugar donde vivas o trabajes.</li>
        </ul>
        <p>Estos derechos se aplican vivas donde vivas (también bajo el RGPD del Reino Unido, la LGPD de Brasil y leyes estatales de EE. UU. como la CCPA/CPRA). No vendemos ni compartimos datos personales con fines publicitarios.</p>
      </>
    )},
    { id: "cookies", title: "6. Cookies", body: (
      <>
        <p>Solo cookies estrictamente necesarias o que tú pides, por eso no hay banner de consentimiento:</p>
        <ul>
          <li>Cookies de seguridad de Cloudflare Turnstile, en los formularios con verificación anti-bots.</li>
          <li>Sesión del equipo (12 horas) y paso de verificación en dos pasos (5 minutos).</li>
          <li>Comprobación del acceso con Twitch (10 minutos), solo mientras un streamer entra con Twitch.</li>
          <li>Idioma (1 año), solo si eliges uno en el menú.</li>
        </ul>
        <p>El tema de color se guarda en tu navegador y nunca se nos envía.</p>
      </>
    )},
    { id: "security", title: "7. Seguridad", body: (
      <p>Las fotos y los vídeos están en un almacenamiento privado y solo se muestran mediante enlaces temporales. Solo los Site Admins crean cuentas del equipo, y cada streamer puede añadir hasta dos Admins a su propio equipo; el equipo usa contraseñas robustas guardadas con hash y verificación en dos pasos (obligatoria para el Owner). Los streamers entran con Twitch y deben estar aprobados antes de crear boards. Cada board tiene contraseñas distintas para la cola y el deck, que se pueden regenerar en cualquier momento para revocar el acceso. El tráfico va cifrado (HTTPS), los inicios de sesión están protegidos contra bots y fuerza bruta, y solo nuestro servidor accede a la base de datos.</p>
    )},
    { id: "minors", title: "8. Edad mínima", body: (
      <p>Debes tener {L.minAge} años o más para enviar. Si sabemos que un envío procede de un menor o lo muestra, lo borramos.</p>
    )},
    { id: "changes", title: "9. Cambios", body: (
      <p>Si cambiamos esta política, actualizamos la versión y la fecha de arriba. Cada envío guarda la versión que se aceptó.</p>
    )},
  ],
};

export default es;
