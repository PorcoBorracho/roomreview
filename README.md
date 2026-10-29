# Room Review: Next.js + Supabase

Web para que cualquier persona envíe fotos de su habitación, con un panel de administración y una vista para el streamer, ambos protegidos por contraseña. Todo funciona con planes gratuitos: Vercel Hobby, Supabase Free y Cloudflare Turnstile.

| Ruta | Quién entra | Qué puede hacer |
|---|---|---|
| `/` | Cualquiera (invitado) | Enviar una entrega con hasta 5 fotos |
| `/admin` | Contraseña de **admin** | Ver, aprobar, devolver a pendiente y borrar entregas, y ver los emails |
| `/streamer` | Contraseña de **viewer** (o de admin) | Ver las entregas aprobadas, sin emails |

---

## ⚠️ Antes de empezar: claves del proyecto antiguo

El HTML original llevaba **la Master Key de JSONBin y las contraseñas escritas en el código**, así que cualquiera que abriera la web podía leerlas. Si esa versión estuvo publicada:

1. **JSONBin:** borra el bin y **regenera la Master Key** (o elimina la cuenta).
2. **Cloudinary:** borra el *upload preset* `roomreview` sin firmar y, si no lo vas a usar más, las imágenes subidas.
3. **No reutilices** las contraseñas antiguas (`5wV4…` y `AmiP…`).

Este proyecto ya no usa JSONBin ni Cloudinary.

---

## 1. Requisitos

- **Node.js 20.9 o superior** (recomendado 22 LTS): <https://nodejs.org>
- **Git** y una cuenta de **GitHub**
- Cuentas gratuitas en **Supabase** (<https://supabase.com>), **Vercel** (<https://vercel.com>) y **Cloudflare** (<https://dash.cloudflare.com>)

Comprueba la versión de Node:

```bash
node -v
```

---

## 2. Instalar el proyecto en tu ordenador

```bash
cd room-review
npm install
cp .env.example .env.local
```

En Windows (PowerShell), en lugar de `cp` usa `copy .env.example .env.local`.

En los pasos siguientes irás rellenando `.env.local`.

---

## 3. Configurar Supabase

### 3.1 Crear el proyecto
1. En <https://supabase.com/dashboard> pulsa **New project**.
2. Elige un nombre, una contraseña de base de datos fuerte (guárdala) y **una región de la Unión Europea**, por ejemplo *Central EU (Frankfurt)*. Mantener los datos en la UE simplifica el cumplimiento del RGPD. Londres y Zúrich no son UE, y la región **no se puede cambiar** después.
3. Espera a que termine de crearse (1–2 minutos).

### 3.2 Crear las tablas, la seguridad y el bucket de fotos
1. Menú lateral → **SQL Editor** → **New query**.
2. Copia **todo** el contenido de `supabase/schema.sql`, pégalo y pulsa **Run**.
3. Debe terminar sin errores. El script se puede volver a ejecutar sin perder datos.

Para comprobarlo:
- **Table Editor:** deben aparecer `submissions`, `submission_media` y `rate_limits`, todas con la etiqueta **RLS enabled**.
- **Storage:** debe aparecer el bucket `room-media` marcado como **Private**.

> No añadas políticas RLS ni hagas público el bucket. El diseño es justo ese: las claves públicas no pueden leer ni escribir nada, y todo pasa por el servidor.

### 3.3 Copiar las claves
Ve a **Project Settings → API Keys** (en proyectos antiguos, **Settings → API**):

| En Supabase | Variable en `.env.local` |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`) o la antigua **anon** | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (`sb_secret_…`) o la antigua **service_role** | `SUPABASE_SECRET_KEY` |

> 🔒 La **secret key** da acceso total. Nunca la pongas en el código, en capturas ni en variables que empiecen por `NEXT_PUBLIC_`.

---

## 4. Configurar Cloudflare Turnstile (captcha gratuito)

Para desarrollo local, `.env.example` ya incluye las **claves de prueba** oficiales de Cloudflare, que siempre pasan. Para producción necesitas las tuyas:

1. <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Nombre: `Room Review`. En **Hostnames** añade tu dominio de Vercel (por ejemplo `tu-proyecto.vercel.app`) y `localhost`.
3. Modo: **Managed**.
4. Copia la **Site Key** en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y la **Secret Key** en `TURNSTILE_SECRET_KEY`.

---

## 5. Crear las contraseñas de admin y viewer

Las contraseñas **no se guardan en texto plano**, solo su hash (scrypt). Genera cada una con:

```bash
npm run hash-password
```

Escribe la contraseña (no se mostrará en pantalla) y copia el resultado, que empieza por `scrypt:`:

- Hash de la contraseña de admin → `ADMIN_PASSWORD_HASH`
- Hash de la contraseña de streamer → `VIEWER_PASSWORD_HASH`

Recomendaciones:
- Mínimo **16 caracteres** y distintas entre sí. Usa un gestor de contraseñas.
- **Cambiar una contraseña cierra automáticamente** todas las sesiones abiertas con ella.

---

## 6. Secretos de sesión y cron

Genera dos cadenas aleatorias (ejecuta el comando dos veces):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- La primera → `SESSION_SECRET` (firma las cookies de sesión; si la cambias, se cierran todas las sesiones).
- La segunda → `CRON_SECRET` (protege la tarea diaria de limpieza).

---

## 7. Probar en local

```bash
npm run dev
```

Abre <http://localhost:3000> y comprueba:
1. Envía una entrega con 1–5 fotos y verás el aviso *Submission Received!*
2. Entra en **Admin Queue** con la contraseña de admin y aprueba la entrega.
3. Entra en **Streamer View** y la entrega aprobada aparecerá ahí.

Atajos de teclado en la vista streamer: **← →** cambian de foto, **↑ ↓** cambian de entrega y **F** abre la pantalla completa.

---

## 8. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Room Review inicial"
```

En GitHub crea un repositorio nuevo (**Private** recomendado) y luego:

```bash
git remote add origin https://github.com/TU_USUARIO/room-review.git
git branch -M main
git push -u origin main
```

> `.env.local` está en `.gitignore` y **no se sube**. Compruébalo en GitHub: no debe aparecer.

---

## 9. Desplegar en Vercel

1. <https://vercel.com/new> → **Import** tu repositorio de GitHub.
2. Framework: **Next.js** (se detecta solo). No cambies los comandos de build.
3. Abre **Environment Variables** y añade **todas** las variables de `.env.local`, con los valores de producción:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key |
   | `SUPABASE_SECRET_KEY` | Secret / service_role key |
   | `ADMIN_PASSWORD_HASH` | `scrypt:…` |
   | `VIEWER_PASSWORD_HASH` | `scrypt:…` |
   | `SESSION_SECRET` | Cadena aleatoria |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Tu Site Key real (no la de prueba) |
   | `TURNSTILE_SECRET_KEY` | Tu Secret Key real |
   | `CRON_SECRET` | Cadena aleatoria |

4. Pulsa **Deploy**.
5. Si tu dominio final es distinto del que pusiste en Turnstile, añádelo en Cloudflare → Turnstile → tu widget → Hostnames.

La limpieza diaria (`vercel.json`) se activa sola. Vercel envía `CRON_SECRET` automáticamente y la tarea borra cada día las subidas que se quedaron a medias. La verás en **Settings → Cron Jobs**.

> Cada vez que cambies una variable de entorno en Vercel, haz **Redeploy** para que se aplique.

---

## 10. Cómo está protegida la web

**Accesos y roles**
- **Invitados:** solo pueden *crear* entregas. No pueden leer, editar ni borrar nada, ni siquiera lo que acaban de subir.
- Las contraseñas se comprueban **en el servidor** con scrypt en tiempo constante. Nunca viajan al navegador ni están en el código.
- La sesión es una cookie `__Host-` firmada (JWT HS256) con las opciones `HttpOnly`, `Secure` y `SameSite=Strict`. Caduca a las 12 h.
- **Doble control de acceso:** el *proxy* de Next.js bloquea `/admin` y `/streamer`, y además **cada página y cada acción** vuelve a comprobar el rol en el servidor.
- La vista streamer **nunca recibe los emails**.

**Base de datos y fotos**
- RLS activado y forzado, **sin políticas**, y permisos revocados a `anon` y `authenticated`. La clave pública no puede leer ninguna tabla.
- Bucket **privado**:
  - Solo se sube mediante URLs firmadas **de un solo uso** que genera el servidor.
  - Solo se ve mediante URLs firmadas temporales.
  - Supabase rechaza en origen los archivos de más de 10 MB o que no sean JPEG, PNG o WebP.
- Los archivos se guardan con nombres aleatorios (UUID), nunca con el nombre original.

**Validación de las subidas**
- El navegador **vuelve a codificar cada foto**: elimina los metadatos EXIF (incluido el **GPS**), corrige la orientación y la reduce a 2560 px como máximo.
- Antes de publicar una entrega, el servidor comprueba que todos los archivos existen, su tamaño y la **firma binaria real** de cada imagen.
- Todos los campos se validan con Zod en el servidor (longitud, caracteres permitidos, email). React escapa todo el texto que se muestra.

**Anti-abuso**
- Captcha Turnstile en cada envío.
- Límites de peticiones atómicos en Postgres:
  - 5 envíos por hora por IP y 300 por hora en total.
  - Login: 5 intentos cada 15 minutos por IP y 60 en total por rol.
- Las IPs se guardan como hash HMAC, nunca en claro.

**Concurrencia (no se pierden datos)**
- Cada entrega y sus fotos se crean en **una sola transacción** (función `create_submission`): o se guarda todo o nada.
- Cada envío es una fila independiente, así que dos usuarios a la vez nunca se pisan. El sistema antiguo, en cambio, reescribía un JSON entero en cada envío.
- Aprobar, devolver a pendiente y borrar son **operaciones condicionales**. Si dos admins actúan a la vez sobre la misma entrega, solo una acción se aplica y el otro admin recibe un aviso.

**Cabeceras HTTP:** CSP estricta, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy`. Además, `/admin`, `/streamer` y `/login` se sirven sin caché y con `noindex`.

---

## 11. Privacidad y protección de datos (RGPD / LOPDGDD)

> ⚠️ Esto no es asesoramiento legal. El proyecto incluye las piezas técnicas y un texto de política de privacidad pensado para el RGPD europeo y la LOPDGDD española. Si la web va a tener uso comercial, o un volumen grande de participantes, haz que un profesional revise los textos.

### Qué incluye ya la web
- **Política de privacidad y condiciones de las fotos** en inglés y español: `/privacy`.
- **Paso de revisión antes de enviar.** Al pulsar *Review and submit* se abre una ventana con la guía de privacidad de las fotos, la información básica sobre protección de datos (primera capa, art. 11 LOPDGDD) y las casillas. **No se envía nada hasta confirmar.** El captcha de Cloudflare solo se carga en ese paso.
- **Cuatro casillas de consentimiento**, sin marcar y obligatorias, que también se comprueban en el servidor:
  - tener 18 años o más;
  - que no aparecen personas, menores ni datos sensibles;
  - aceptar la emisión pública;
  - aceptar la política de privacidad.
- **Registro del consentimiento:** cada entrega guarda la fecha y la versión de la política aceptada (art. 7.1 RGPD).
- **Avisos detallados** sobre las fotos: personas, nombres, documentos, pantallas, pistas de ubicación, datos sensibles y emisión pública. Junto a la zona de subida hay un aviso breve, y en el paso de revisión, la lista completa.
- **Derecho de supresión sin cuenta:** al enviar, la persona recibe un **código de borrado** (solo se guarda su hash) que puede usar en `/delete`.
- **Borrado automático** de las entregas a los 90 días (`retentionDays`), gracias al cron diario.
- **Avisos al equipo:**
  - En `/admin`, recordatorio de confidencialidad y **emails ocultos por defecto**, por si la pantalla sale en directo.
  - En `/streamer`, botón **Blur** (tecla **B**) que difumina la foto al instante si se cuela algo personal.
- **Solo cookies técnicas** (sesión de moderadores y Turnstile). Por eso no hace falta banner de cookies.

### Lo que tienes que hacer tú antes de publicar
1. **Rellena `src/config/legal.ts`:**
   - tu nombre o razón social;
   - ciudad y país;
   - un **email de contacto operativo**;
   - la región de Supabase que elegiste.

   Mientras falten datos, en local aparece un aviso amarillo en el pie de la página.
2. **Acepta los contratos de encargo de tratamiento (DPA)** de cada proveedor. Los encontrarás en la sección legal de cada uno: Supabase (<https://supabase.com/legal/dpa>), Vercel y Cloudflare. Guarda una copia.
3. **Crea tu registro de actividades de tratamiento** (art. 30 RGPD). Basta un documento con este contenido:
   - *Actividad:* selección de habitaciones para emisión en directo.
   - *Datos:* usuario, email, país, descripción y fotos; IP cifrada con fines de seguridad.
   - *Base jurídica:* consentimiento, e interés legítimo para la seguridad.
   - *Destinatarios:* moderadores, público del directo (solo lo aprobado), Supabase, Vercel y Cloudflare.
   - *Transferencias:* EE. UU. (DPF / cláusulas tipo).
   - *Plazo:* 90 días.
   - *Medidas de seguridad:* las del apartado 10.
4. **Revisa la configuración de tu canal en Twitch.** Decide cuánto tiempo guardas los VODs y si permites clips. Si alguien pide que se borre su habitación, borra también los VODs y clips del canal donde aparezca.
5. **Atiende las peticiones por email** (acceso, borrado, etc.) en un plazo máximo de **un mes**. Para borrar a mano, usa el botón Delete del panel de admin.
6. **Revisa cada foto antes de aprobarla**, aunque quien la envía haya confirmado que no hay datos personales. Ante la duda, no la apruebes.
7. Si cambias la política de privacidad, **sube `policyVersion`** en `legal.ts`. Así sabrás qué versión aceptó cada entrega.

### Cambiar plazos o edad mínima
En `src/config/legal.ts`:
- `retentionDays` controla los días de conservación. Se aplica cada noche con el cron.
- `minAge` es la edad mínima, 18 por defecto. En España se puede consentir desde los 14, y hay un proyecto de ley en el Congreso para subirlo a 16. Exigir 18 evita tratar datos de menores, así que se recomienda no bajarla.

---

## 12. Límites del plan gratuito

Estos límites cambian con el tiempo; revisa las páginas de precios de Supabase y Vercel.

- **Supabase Free:**
  - Unos **1 GB de almacenamiento** de archivos. Con la compresión automática, una foto ocupa unos 0,5–1,5 MB, así que caben **entre 700 y 2000 fotos**. Borra las entregas antiguas desde el panel de admin para liberar espacio.
  - El proyecto **se pausa tras ~7 días sin actividad**. Se reactiva desde el dashboard de Supabase (*Restore project*). El cron diario de Vercel hace una consulta cada día, lo que normalmente evita la pausa.
- **Vercel Hobby:** solo para **uso no comercial**. El cron se ejecuta una vez al día.

---

## 13. Copias de seguridad (recomendado)

El plan gratuito de Supabase no incluye copias descargables. Para exportar la base de datos manualmente:

1. Supabase → botón **Connect** (arriba) → copia la cadena de conexión de tipo **Session pooler**.
2. Con Docker instalado, ejecuta:

```bash
docker run --rm postgres:17 pg_dump "CADENA_DE_CONEXION" --schema=public --data-only > backup.sql
```

> El backup contiene emails: guárdalo en un sitio privado. Las fotos no se incluyen; se pueden descargar desde Supabase → Storage.

---

## 14. Problemas frecuentes

| Problema | Solución |
|---|---|
| `Falta la variable de entorno …` | Falta esa variable en `.env.local` o en Vercel. Añádela y reinicia o redespliega. |
| El captcha no aparece o falla | El dominio no está en Hostnames de Turnstile, o estás usando las claves de prueba en producción. |
| *"Incorrect password"* con la contraseña correcta | El hash se copió incompleto. Debe tener 6 partes separadas por `:`. Vuelve a generarlo. |
| *"Too many attempts"* | Espera 15 minutos, o en Supabase → Table Editor → `rate_limits` borra las filas que empiezan por `login:`. |
| Error al subir fotos | Revisa que se ejecutó `schema.sql` (el bucket `room-media` debe existir) y que las claves de Supabase son correctas. |
| Las imágenes del streamer dejan de verse tras horas abiertas | Las URLs firmadas caducan. La vista se refresca sola cada 30 min; también puedes pulsar el botón ⟳. |
| Supabase da error tras días sin uso | El proyecto está pausado. Reactívalo desde el dashboard. |
| Error `function create_submission(...) does not exist` tras actualizar | Vuelve a ejecutar `supabase/schema.sql` completo en el SQL Editor. Añade las columnas de consentimiento sin perder datos. |

---

## Estructura del proyecto

```
supabase/schema.sql        Tablas, RLS, funciones atómicas y bucket privado
scripts/hash-password.mjs  Genera los hashes de las contraseñas
src/proxy.ts               Bloquea /admin y /streamer sin sesión
src/actions/               Lógica de servidor (envío, login, acciones de admin)
src/lib/                   Sesión, validación, rate limit, Supabase, captcha
src/components/            Interfaz (formulario, cola admin, vista streamer)
src/app/                   Páginas: / , /login , /admin , /streamer , /privacy , /delete
src/config/legal.ts        Tus datos legales, plazo de conservación y edad mínima
vercel.json                Cron diario de limpieza
```
