# Reviews: Next.js + Supabase

[English](README.md) · **Español**

Proyecto hecho usando Claude.

📘 Guía de uso (en inglés): [docs/Stream-Reviews-User-Guide.pdf](docs/Stream-Reviews-User-Guide.pdf)

Web para recibir fotos (y vídeos cortos) de la comunidad y revisarlos en directo. Varios **streamers** usan la misma web: entran con **Twitch**, tienen su **página pública** con sus **boards** (Room Review, Costume Review, Pet Review…) y su propio equipo de moderación. Los visitantes buscan a su streamer desde la página de inicio. Todo funciona con planes gratuitos: Vercel Hobby, Supabase Free, Cloudflare Turnstile y una aplicación de Twitch.

## Roles

| Rol | Cómo entra | Qué puede hacer |
|---|---|---|
| **Invitado** | Sin cuenta | Buscar streamers, enviar una entrega a un board abierto (fotos y, si el board lo permite, un vídeo), borrar la suya con su código, reportar un problema |
| **Streamer** | **Twitch** (la primera vez, un Site Admin tiene que aprobarlo) | Crear y editar **sus** boards y abrir su **deck**, pero **no la cola**. Su **equipo** puede tener hasta **2 Admins**: crea cuentas nuevas (contraseña de un solo uso) o añade Admins que ya existen |
| **Board Admin** | Contraseña de Board Admin **de un board**, en `/{streamer}/{board}/queue` | Moderar la **cola** de ese board y ver su deck |
| Acceso al deck | Contraseña de streamer **de un board** | Ver el **deck** de ese board (útil para OBS u otro ordenador) |
| **Admin** | Cuenta (usuario + contraseña, 2FA opcional) | Gestionar y moderar los boards que crea, los que le compartan y **todos los de los streamers de cuyo equipo forma parte**. Solo puede crear boards para esos streamers |
| **Site Admin** | Cuenta | Todo lo anterior en **todos** los boards; aprobar, suspender y gestionar el equipo de cualquier streamer; crear cuentas; dar o quitar el rol de Site Admin; problemas reportados y registro de actividad |
| **Owner** | Cuenta con **2FA obligatoria** | Lo mismo que un Site Admin. Es la primera cuenta, creada en `/setup`. Nadie puede degradarla, borrarla ni restablecer su contraseña |

**Restablecer la contraseña del Owner:** solo puede volver a la **contraseña de configuración** (`ADMIN_PASSWORD_HASH`):
- con sesión: **Account → Reset to the setup password** (pide un código 2FA);
- sin acceso: en un ordenador con el proyecto y en `.env.local` los valores de producción de `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `ADMIN_PASSWORD_HASH`:

  ```bash
  npm run reset-owner                 # mantiene la verificación en dos pasos
  npm run reset-owner -- --clear-2fa  # además la quita (móvil perdido); tendrá que activarla otra vez
  ```

En ambos casos se cierran todas sus sesiones y tiene 72 horas para entrar con la contraseña de configuración y elegir una nueva.

## Rutas

| Ruta | Quién entra | Qué hay |
|---|---|---|
| `/` | Cualquiera | **Buscador de streamers** y streamers con boards abiertos |
| `/{streamer}` (p. ej. `/pixelwitch`) | Cualquiera | Página pública del streamer con sus boards activos |
| `/{streamer}/{board}` | Cualquiera | Enviar una entrega (hasta 5 archivos) |
| `/{streamer}/{board}/queue` | Admins del board y del equipo, Site Admin o Board Admin | Moderar las entregas |
| `/{streamer}/{board}/deck` | Los anteriores y el streamer | Mostrar en directo las entregas aprobadas |
| `/panel` | Cualquier cuenta | **Panel de control** de boards |
| `/team` | Streamer | Su equipo de Admins |
| `/streamers` | Site Admin / Owner | Solicitudes de streamers, aprobar, suspender, equipos |
| `/admins` | Site Admin / Owner | Cuentas del equipo |
| `/problems`, `/audit` | Site Admin / Owner | Problemas reportados y registro de actividad |
| `/account` | Cualquier cuenta | Contraseña y 2FA (los streamers lo gestionan en Twitch) |
| `/report`, `/privacy`, `/delete`, `/contact` | Cualquiera | Reportar un problema, privacidad, borrado con código y contacto |
| `/setup` | Solo mientras no exista ninguna cuenta del equipo | Crear el Owner |

## Idiomas

La web está en **inglés, español, portugués, francés y japonés**. Se elige sola según el idioma del navegador y se puede cambiar con el selector de la cabecera (se recuerda un año). Los textos están en `src/i18n/dict/` y la política de privacidad en `src/i18n/privacy/`. Si cambias un texto en inglés, cambia también los otros idiomas: el proyecto no compila si a un idioma le falta un texto.

Este README está en español.

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
- Cuentas gratuitas en **Supabase** (<https://supabase.com>), **Vercel** (<https://vercel.com>) y **Cloudflare** (<https://dash.cloudflare.com>), y una cuenta de **Twitch** con la verificación en dos pasos activada (Twitch la exige para registrar aplicaciones)

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
3. Debe terminar sin errores. El script se puede volver a ejecutar sin perder datos: **ejecútalo de nuevo cada vez que actualices el proyecto**.

Para comprobarlo:
- **Table Editor:** deben aparecer `boards`, `submissions`, `submission_media`, `rate_limits`, `admins`, `board_members`, `streamer_admins`, `problem_reports` y `audit_log`, todas con la etiqueta **RLS enabled**.
- **Storage:** debe aparecer el bucket `room-media` marcado como **Private**. Acepta archivos de hasta 20 MB (por los vídeos); si en **Storage → Settings** tu proyecto tiene un *Upload file size limit* menor, súbelo al menos a 20 MB.

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

Turnstile protege el envío de fotos, **todos los inicios de sesión**, la configuración inicial y el formulario de problemas. Para desarrollo local, `.env.example` ya incluye las **claves de prueba** oficiales de Cloudflare, que siempre pasan. Para producción necesitas las tuyas:

1. <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Nombre: `Stream Reviews`. En **Hostnames** añade tu dominio de Vercel (por ejemplo `tu-proyecto.vercel.app`) y `localhost`.
3. Modo: **Managed**.
4. Copia la **Site Key** en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y la **Secret Key** en `TURNSTILE_SECRET_KEY`.

---

## 4b. Configurar el acceso con Twitch (streamers)

Los streamers entran con Twitch. La web solo lee su identidad pública (ID, nombre e imagen): no pide ningún permiso y no guarda ningún token de Twitch.

1. Entra en <https://dev.twitch.tv/console/apps> y pulsa **Register Your Application** (tu cuenta de Twitch necesita la verificación en dos pasos).
2. **Name:** cualquiera que no esté cogido, p. ej. *Stream Reviews – tu-dominio*.
3. **OAuth Redirect URLs:** añade `https://tu-dominio/api/auth/twitch/callback` y, para probar en local, `http://localhost:3000/api/auth/twitch/callback`. Tienen que coincidir exactamente.
4. **Category:** *Website Integration*. **Client Type:** *Confidential*.
5. Créala, copia el **Client ID** en `TWITCH_CLIENT_ID`, pulsa **New Secret** y cópialo en `TWITCH_CLIENT_SECRET`.

Sin estas variables la web funciona, pero los streamers no pueden entrar (los Site Admins ven un aviso en **Streamers**). Las URLs de *preview* de Vercel no están registradas en Twitch: prueba el acceso con Twitch en tu dominio de producción o en local.

---

## 5. Contraseña de configuración (crea el Owner)

`ADMIN_PASSWORD_HASH` es la contraseña de **configuración**: sirve en `/setup` para crear el **Owner** (el primer Site Admin). Después `/setup` desaparece, y solo vuelve a usarse si se restablece la contraseña del Owner (ver [Roles](#roles)). Guárdala en un gestor de contraseñas.

La contraseña **no se guarda en texto plano**, solo su hash (scrypt). Genérala con:

```bash
npm run hash-password
```

Escribe la contraseña (no se mostrará en pantalla) y copia el resultado, que empieza por `scrypt:`, en `ADMIN_PASSWORD_HASH`.

> Si ya tenías el proyecto funcionando, puedes dejar el hash que tenías: tu antigua contraseña de admin será la de configuración.

---

## 6. Secretos de sesión y cron

Genera dos cadenas aleatorias (ejecuta el comando dos veces):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- La primera → `SESSION_SECRET`. Firma las cookies de sesión y, mediante claves derivadas, cifra las contraseñas de los boards y las claves de la verificación en dos pasos. **Si la cambias:** se cierran todas las sesiones, las contraseñas de los boards siguen sirviendo pero no se pueden copiar (regenéralas) y quien tenga el 2FA activo no podrá entrar hasta que un Site Admin le restablezca la contraseña.
- La segunda → `CRON_SECRET` (protege la tarea diaria de limpieza).

---

## 7. Primer arranque y prueba en local

```bash
npm run dev
```

1. Abre <http://localhost:3000> y pulsa **Sign in**. Verás el aviso *No admin accounts exist yet* → **Set up the site**.
2. En `/setup` escribe la **contraseña de configuración**, tu usuario y tu contraseña (mínimo 12 caracteres, sin contener el usuario). Esa cuenta es el **Owner**.
3. Activa la **verificación en dos pasos**: es obligatoria para el Owner y el panel no se abre hasta hacerlo.
4. En una ventana privada pulsa **Continue with Twitch** con una cuenta de streamer: queda como solicitud.
5. Como Owner, en **Streamers**, apruébala.
6. En la ventana privada vuelve a entrar con Twitch: crea un board y, en **Team**, añade hasta dos Admins.
7. Abre el enlace público del board (`/streamer/board`) en otra ventana y envía una entrega.
8. Un Admin del equipo (o quien tenga la contraseña de **Board Admin**) la aprueba en la cola.
9. El streamer abre el deck: cada review empieza **difuminada** hasta que pulsa **Reveal**.

Detener el servidor: `Ctrl + C` en la terminal.

**Modo claro / oscuro:** el selector de la cabecera tiene dos opciones, claro y oscuro. Hasta que eliges una, la web usa el tema de tu dispositivo (y cambia con él). En ambos temas, el fondo de las fotos del deck sigue oscuro, porque es lo que sale en directo.

Atajos de teclado en el deck (no se muestran en pantalla): **← →** cambian de foto, **↑ ↓** cambian de entrega, **+ / −** zoom, **B** difumina y **F** abre la pantalla completa.

---

## 8. Uso del panel

### Cuentas (Site Admin → **Admins**)
- **New admin:** escribe el usuario y elige el rol (*Admin* o *Site Admin*). Se muestra **una sola vez** una **contraseña de un solo uso** que caduca en **72 horas**. Envíasela a la persona por un canal privado. Al entrar, la web le obliga a elegir su propia contraseña antes de hacer nada más.
- **Reset password** (mantener pulsado): nueva contraseña de un solo uso. Cierra todas sus sesiones y **desactiva su 2FA** (sirve si perdió el móvil).
- **Make / Remove Site Admin:** cambia el rol. Cierra sus sesiones para que vuelva a entrar con el rol nuevo. Al pasar a Site Admin deja los equipos de streamer (ya lo ve todo).
- **Delete account** (mantener pulsado): sus boards pasan a ti.
- El **Owner** no tiene acciones aquí: nadie puede cambiarlo, borrarlo ni restablecer su contraseña.

### Streamers (Site Admin → **Streamers**)
- **Requests:** cuando alguien entra con Twitch por primera vez queda como solicitud. **Approve** la acepta; **Reject** (mantener pulsado) la borra. Las que nadie aprueba se borran solas a los 30 días.
- **Suspend** (mantener pulsado): cierra su sesión al instante y oculta su página y sus boards hasta que lo reactives.
- **Equipo:** en cada streamer activo puedes añadir Admins existentes (máximo 2) o quitarlos.

### Equipo del streamer (Streamer → **Team**)
- Hasta **2 Admins**: crea una cuenta nueva (verás una contraseña de un solo uso para enviársela) o añade un Admin que ya tenga cuenta.
- Esos Admins crean y editan sus boards, moderan la cola y ven los emails de quien envía: añade solo a personas de confianza.

### Boards
- **Streamer:** cada board pertenece a un streamer y su dirección es `/{streamer}/{board}`. Un streamer crea los suyos; un Admin, solo para los streamers de su equipo; un Site Admin, para cualquiera. El nombre del streamer aparece en la página pública y en la casilla de consentimiento.
- **Dueño:** quien crea un board es su dueño. Pueden **borrarlo** el dueño, su streamer o un Site Admin; **compartirlo**, el dueño o un Site Admin.
- **Shared with:** en *Edit*, escribe el usuario de otro admin y pulsa **Share**. Ese admin podrá editar el board, moderarlo y copiar o regenerar sus contraseñas.
- **Blur each new review in the deck** (activado por defecto): en el deck cada entrega empieza difuminada hasta que el streamer pulsa **Reveal**. Desactívalo para mostrar las fotos directamente.
- **Allow a video:** quien envía puede añadir **un vídeo** (además de fotos). Se comprime en su navegador a 720p, se recorta a 60 s y se envía **sin sonido ni metadatos** (≈11 MB por minuto). Ocupa más que las fotos: actívalo solo donde haga falta.
- **Active:** si está apagado, la página pública da 404. El equipo sigue viéndola.
- **Accepting submissions:** si está apagado, la página se ve, pero el formulario está cerrado y el servidor rechaza los envíos.
- **People may appear in photos:** para boards donde salgan personas, como disfraces. Cambia los avisos y la casilla de consentimiento. **Nunca menores.**
- **Edit:** si otra persona guardó cambios mientras editabas, se te avisa en lugar de sobrescribirlos.
- **Delete board** (mantener pulsado): borra el board con **todas** sus entregas y fotos.

### Contraseñas de cada board
Cada board tiene dos:

| Contraseña | Abre | Dónde se comparte |
|---|---|---|
| **Board Admin** | `/{streamer}/{board}/queue` (y el deck) | Moderadores de confianza |
| **Streamer** | `/{streamer}/{board}/deck` | El streamer en otro equipo u OBS (con su cuenta de Twitch no la necesita) |

- En cada tarjeta del panel hay botones para copiar el **enlace** y la **contraseña** de cada una.
- **Regenerate** (en *Edit*, mantener pulsado): crea una contraseña nueva en el servidor y **expulsa al instante** a todos los que entraron con la anterior. Así se **revoca** el acceso de un moderador o de un streamer.
- Los boards antiguos no tienen contraseña de Board Admin: la tarjeta muestra **Set up**; pulsa *Generate password* en *Edit*.
- Se guardan como **hash** (para comprobar el login) y como **copia cifrada** (para poder copiarlas).

### Problemas reportados (Site Admin → **Problems**)
- Cualquiera puede usar **Report a problem** (pie de página). El reporte llega con la página o el board desde el que se envió.
- Puedes marcarlos como resueltos, reabrirlos o borrarlos. Los resueltos se borran solos a los **30 días** (y cualquiera, al año).

### Registro de actividad (Site Admin → **Activity**)
- Anota **quién hizo qué y cuándo**: inicios de sesión (también los fallidos), cambios de contraseña y de 2FA, creación, cambios de rol y borrado de cuentas, creación, edición y borrado de boards, contraseñas de board copiadas o regeneradas, compartir boards, aprobar, devolver y borrar entregas, borrados hechos por quien envió (con su código), problemas resueltos y la limpieza automática.
- Se puede filtrar por tipo y por board.
- **No guarda datos de quien envía fotos** (ni email ni usuario): solo el id de la entrega. Tampoco guarda contraseñas ni valores editados, solo qué campos cambiaron.
- La conexión se guarda **seudonimizada** (hash con clave de la IP): sirve para ver que varios intentos vienen del mismo sitio, no para saber quién es.
- Es **inalterable**: la base de datos impide modificar entradas o borrar las que tengan menos de 365 días, incluso con la clave secreta de Supabase. El cron diario borra las más antiguas.

### Verificación en dos pasos (2FA)
En **Account → Set up two-step verification**: escanea el código QR con una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password, Aegis, Bitwarden…), escribe el código y tu contraseña. Desde entonces, cada inicio de sesión pide el código. Cada código solo vale una vez.

Algunos nombres están reservados porque son páginas de la web (`login`, `privacy`, `panel`, `streamers`, `team`, `account`, `setup`…): no se pueden usar para boards, y un streamer de Twitch con uno de esos nombres no puede registrarse.

---

## 9. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Stream Reviews inicial"
```

En GitHub crea un repositorio nuevo (**Private** recomendado) y luego:

```bash
git remote add origin https://github.com/TU_USUARIO/room-review.git
git branch -M main
git push -u origin main
```

> `.env.local` está en `.gitignore` y **no se sube**. Compruébalo en GitHub: no debe aparecer.

---

## 10. Desplegar en Vercel

1. <https://vercel.com/new> → **Import** tu repositorio de GitHub.
2. Framework: **Next.js** (se detecta solo). No cambies los comandos de build.
3. Abre **Environment Variables** y añade **todas** las variables de `.env.local`, con los valores de producción:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key |
   | `SUPABASE_SECRET_KEY` | Secret / service_role key |
   | `ADMIN_PASSWORD_HASH` | `scrypt:…` (contraseña de configuración) |
   | `SESSION_SECRET` | Cadena aleatoria |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Tu Site Key real (no la de prueba) |
   | `TURNSTILE_SECRET_KEY` | Tu Secret Key real |
   | `TWITCH_CLIENT_ID` | Client ID de tu aplicación de Twitch |
   | `TWITCH_CLIENT_SECRET` | Secret de tu aplicación de Twitch |
   | `CRON_SECRET` | Cadena aleatoria |

   Si Vercel sugiere quitar el prefijo `NEXT_PUBLIC_`, no lo quites: esas claves son públicas por diseño. Márcalas como **Config** y el resto como **Sensitive**.

4. Pulsa **Deploy**.
5. Abre tu dominio y crea el Owner en `/setup` (paso 7).
6. Si tu dominio final es distinto del que pusiste en Turnstile, añádelo en Cloudflare → Turnstile → tu widget → Hostnames, y su URL de vuelta en las **OAuth Redirect URLs** de Twitch.

La limpieza diaria (`vercel.json`) se activa sola. Vercel envía `CRON_SECRET` automáticamente y la tarea borra cada día las subidas a medias, las entregas caducadas, los problemas resueltos antiguos, las solicitudes de streamer sin aprobar de más de 30 días y las entradas del registro de actividad de más de un año. La verás en **Settings → Cron Jobs**.

> Cada vez que cambies una variable de entorno en Vercel, haz **Redeploy** para que se aplique.

---

## 11. Actualizar desde una versión anterior

1. Guarda tus datos de `src/config/legal.ts` (nombre, dirección, email, región).
2. Sustituye la carpeta del proyecto por la nueva, **excepto** `.env.local`.
3. Copia en el nuevo `src/config/legal.ts` **solo tus datos personales**. Deja el `policyVersion` nuevo: la política ha cambiado.
4. `npm install` (hay una dependencia nueva para el código QR del 2FA).
5. Ejecuta **todo** `supabase/schema.sql` en el SQL Editor de Supabase.
6. Añade `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` (paso 4b) y despliega.

**Desde la versión sin cuentas de streamer:**
- El Site Admin más antiguo pasa a ser el **Owner** y tendrá que activar la verificación en dos pasos al entrar.
- Las direcciones cambian de `/{board}` a `/{streamer}/{board}`. Los boards existentes aparecen en el panel como *No streamer set* hasta que un Site Admin los edita y elige su streamer (después de que ese streamer entre con Twitch y lo apruebes). Hasta entonces no tienen página pública.
- Sube `policyVersion` en tu `src/config/legal.ts`: la política de privacidad ha cambiado.

---

## 12. Cómo está protegida la web

**Cuentas y sesiones**
- Registro cerrado para el equipo: solo un Site Admin (o un streamer, como máximo 2 Admins para su equipo) crea cuentas, con una contraseña de un solo uso (≈99 bits) que caduca en 72 h y obliga a elegir otra al entrar.
- Streamers con **Twitch** (OAuth con `state` firmado de un solo uso en una cookie; sin permisos; el token se revoca nada más leer el perfil) y **aprobación** de un Site Admin. Suspender a un streamer corta su sesión al instante.
- El **Owner** no se puede degradar, borrar ni restablecer desde la web por otra persona, y su 2FA es obligatoria.
- Contraseñas de 12+ caracteres, comprobadas **en el servidor** con scrypt en tiempo constante. Si el usuario no existe se compara igualmente contra un hash de relleno, para no revelarlo por el tiempo de respuesta.
- **Verificación en dos pasos (TOTP)** (opcional; obligatoria para el Owner): el secreto se guarda cifrado; cada código se gasta de forma atómica en la base de datos, así que no se puede reutilizar ni aunque lleguen dos peticiones a la vez.
- La sesión es una cookie `__Host-` firmada (JWT HS256, clave derivada con HKDF) con `HttpOnly`, `Secure` y `SameSite=Strict`. Caduca a las 12 h.
- **En cada petición se vuelve a leer la cuenta** en la base de datos. Cambiar la contraseña, el rol, activar el 2FA o borrar la cuenta **cierra sus sesiones al instante**.
- Los permisos de board llevan la **versión** de la contraseña con la que se obtuvieron: al regenerarla, dejan de valer.

**Accesos**
- **Invitados:** solo pueden *crear* entregas y reportes. No pueden leer, editar ni borrar nada (salvo su entrega, con el código).
- **Doble control:** el *proxy* bloquea las páginas privadas sin sesión, y **cada página y cada acción** comprueba en el servidor el permiso exacto sobre ese board.
- El deck **nunca recibe los emails** y los streamers no pueden abrir la cola. Las páginas de Site Admin dan 404 a quien no lo es.
- El límite de 2 Admins por equipo y la regla de vídeos (solo si el board los permite, uno como máximo) se comprueban dentro de transacciones de Postgres: ni con peticiones simultáneas se pueden superar.

**Anti-abuso**
- Turnstile en el envío de fotos, en **todos los inicios de sesión**, en `/setup` y en el formulario de problemas. El servidor comprueba que el token se emitió para **tu dominio** y para **esa acción**.
- Límites atómicos en Postgres:
  - Envíos: 5 por hora por IP y 100 por hora en total.
  - Login con cuenta: 10 intentos cada 15 min por IP, 10 por usuario y 300 en total. Código 2FA: 6 por usuario cada 15 min.
  - Login de board: 10 por IP, 20 por board y 300 en total cada 15 min.
  - Reportes: 5 por hora por IP y 200 en total.
- Las IPs se guardan como hash HMAC, nunca en claro.

**Base de datos y fotos**
- RLS activado y forzado, **sin políticas**, y permisos revocados a `anon` y `authenticated`. La clave pública no puede leer ninguna tabla.
- Bucket **privado**: solo se sube con URLs firmadas de un solo uso y solo se ve con URLs firmadas temporales. Supabase rechaza archivos de más de 20 MB o que no sean JPEG, PNG, WebP, MP4 o WebM; el servidor comprueba además la firma real de cada archivo y su tamaño (6 MB las fotos).
- El navegador vuelve a codificar cada foto (elimina EXIF y **GPS**). El servidor comprueba tamaño y **firma binaria real** de cada imagen.

**Concurrencia (no se pierden datos)**
- Cada entrega y sus fotos se crean en **una sola transacción**.
- Aprobar, devolver y borrar son **operaciones condicionales**: si dos personas actúan a la vez, solo una se aplica y la otra recibe un aviso.
- Crear el primer Site Admin, cambiar roles, borrar cuentas, regenerar contraseñas y gastar códigos 2FA son funciones atómicas con bloqueos en Postgres.

**Trazabilidad**
- Registro de actividad de solo añadir (`audit_log`), protegido por triggers en Postgres y sin permiso de `UPDATE` ni para la clave secreta. Ver el apartado 8.

**Cabeceras HTTP:** CSP con nonce por petición y `'strict-dynamic'` (`script-src-attr 'none'`, `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`), HSTS, COOP/CORP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy`. Las páginas privadas y `/login` se sirven sin caché y con `noindex`.

---

## 13. Privacidad y protección de datos (RGPD / LOPDGDD)

> ⚠️ Esto no es asesoramiento legal. El proyecto incluye las piezas técnicas y un texto de política de privacidad pensado para el RGPD europeo y la LOPDGDD española. Si la web va a tener uso comercial, o un volumen grande de participantes, haz que un profesional revise los textos.

### Qué incluye ya la web
- **Política de privacidad y condiciones de las fotos** en los cinco idiomas: `/privacy`. Incluye cuentas del equipo y de streamer (Twitch), Board Admins, vídeos, reportes de problemas, 2FA y las cookies.
- **Paso de revisión antes de enviar**, con la guía de privacidad de las fotos y la primera capa informativa (art. 11 LOPDGDD). **No se envía nada hasta confirmar.**
- **Cuatro casillas de consentimiento**, sin marcar y obligatorias, comprobadas también en el servidor.
- **Registro del consentimiento** (fecha y versión de la política, art. 7.1 RGPD).
- **Derecho de supresión sin cuenta** con un código de borrado (solo se guarda su hash).
- **Borrado automático** de entregas a los 90 días y de los problemas resueltos a los 30.
- **Formulario de problemas** para avisar de contenido inapropiado o datos personales visibles.
- **Registro de actividad** del equipo (responsabilidad proactiva, art. 5.2 RGPD), sin datos de quien envía.
- **Avisos al equipo:** emails ocultos por defecto en la cola; en el deck cada review empieza difuminada y hay botón **Blur** (tecla **B**).
- **Vídeos sin sonido ni metadatos**, comprimidos en el navegador.
- **Cuentas de streamer mínimas:** solo ID, login, nombre e imagen de Twitch.
- **Solo cookies técnicas o pedidas por el usuario** (sesión, 2FA, comprobación del acceso con Twitch, Turnstile e idioma). No hace falta banner de cookies.

### Lo que tienes que hacer tú antes de publicar
1. **Rellena `src/config/legal.ts`:** tu nombre o razón social, ciudad y país, un **email de contacto operativo** y la región de Supabase. Mientras falten datos, en local aparece un aviso amarillo en el pie.
2. **Acepta los contratos de encargo de tratamiento (DPA)** de Supabase (<https://supabase.com/legal/dpa>), Vercel y Cloudflare, y el acuerdo para desarrolladores de Twitch. Guarda una copia.
3. **Crea tu registro de actividades de tratamiento** (art. 30 RGPD):
   - *Actividades:* selección de fotos y vídeos para emisión en directo; gestión de reportes de problemas; cuentas del equipo; cuentas de streamer.
   - *Datos:* usuario, email, país, descripción, fotos y vídeo; mensajes de reporte y email opcional; cuentas del equipo y registro de su actividad; ID, login, nombre e imagen de Twitch de los streamers; IP cifrada con fines de seguridad.
   - *Base jurídica:* consentimiento; interés legítimo para seguridad y reportes.
   - *Destinatarios:* equipo de cada board (admins, equipo del streamer, Board Admins, streamer), Site Admins, público del directo (solo lo aprobado), Supabase, Vercel y Cloudflare; Twitch para el acceso de los streamers.
   - *Transferencias:* EE. UU. (DPF / cláusulas tipo).
   - *Plazos:* 90 días las entregas; 30 días tras resolverse los reportes (máx. 1 año); solicitudes de streamer sin aprobar, 30 días; registro de actividad, 1 año.
   - *Medidas de seguridad:* las del apartado 12.
4. **Revisa la configuración de cada canal** (VODs y clips). Si alguien pide que se borre su foto, borra también los VODs y clips donde aparezca.
5. **Atiende las peticiones por email** en un plazo máximo de **un mes**.
6. **Elige bien a quién das la contraseña de Board Admin:** ve emails y fotos sin aprobar. Si alguien deja el equipo, **regenérala**.
7. **Revisa cada foto antes de aprobarla.** Ante la duda, no la apruebes.
8. Si cambias la política de privacidad, **sube `policyVersion`** en `legal.ts`.

### Cambiar plazos o edad mínima
- `retentionDays` y `minAge` en `src/config/legal.ts`. Exigir 18 años evita tratar datos de menores, así que se recomienda no bajarla.
- Plazos de los reportes y del registro de actividad: `REPORT_RESOLVED_DAYS`, `REPORT_MAX_DAYS` y `AUDIT_DAYS` en `src/lib/limits.ts`. Si cambias `AUDIT_DAYS`, cambia también el intervalo de `audit_log_guard` en `schema.sql`.

---

## 14. Límites del plan gratuito

Estos límites cambian con el tiempo; revisa las páginas de precios de Supabase y Vercel.

- **Supabase Free:**
  - Unos **1 GB de almacenamiento** de archivos: entre **700 y 2000 fotos** con la compresión automática. Un vídeo de un minuto ocupa unos 11 MB: activa los vídeos solo en los boards que los necesiten.
  - El proyecto **se pausa tras ~7 días sin actividad**. El cron diario de Vercel normalmente lo evita; si pasa, *Restore project* en el dashboard.
- **Vercel Hobby:** solo para **uso no comercial**. El cron se ejecuta una vez al día.

---

## 15. Copias de seguridad (recomendado)

El plan gratuito de Supabase no incluye copias descargables. Para exportar la base de datos manualmente:

1. Supabase → botón **Connect** (arriba) → copia la cadena de conexión de tipo **Session pooler**.
2. Con Docker instalado, ejecuta:

```bash
docker run --rm postgres:17 pg_dump "CADENA_DE_CONEXION" --schema=public --data-only > backup.sql
```

> El backup contiene emails y hashes de contraseñas: guárdalo en un sitio privado. Las fotos no se incluyen; se pueden descargar desde Supabase → Storage.

---

## 16. Problemas frecuentes

| Problema | Solución |
|---|---|
| `Missing environment variable …` (falta la variable de entorno) | Falta esa variable en `.env.local` o en Vercel. Añádela y reinicia o redespliega. |
| El captcha no aparece o falla | El dominio no está en Hostnames de Turnstile, o estás usando las claves de prueba en producción. |
| `/setup` dice *Incorrect password* | Es la contraseña cuyo hash está en `ADMIN_PASSWORD_HASH`. Si el hash se copió incompleto (debe tener 6 partes separadas por `:`), vuelve a generarlo. |
| `/setup` me lleva al login | Ya existe una cuenta. Entra con ella. |
| *"This one-time password has expired"* | Pasaron 72 h. Un Site Admin debe pulsar **Reset password**. Si es el Owner, vuelve a ejecutar `npm run reset-owner`. |
| Perdí el móvil del 2FA | Otro Site Admin o el Owner pulsa **Reset password** en tu cuenta (desactiva el 2FA). Si eres el **Owner**: `npm run reset-owner -- --clear-2fa`. |
| El Owner olvidó su contraseña | `npm run reset-owner` (ver [Roles](#roles)). |
| *"Twitch sign-in isn't set up on this site yet"* | Faltan `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`. Añádelas y redespliega. |
| Twitch muestra *redirect_mismatch* | La URL de vuelta de tu aplicación de Twitch debe ser exactamente `https://tu-dominio/api/auth/twitch/callback`. |
| Un streamer solo ve *waiting for approval* | Un Site Admin tiene que aprobarlo en **Streamers**. |
| *"Your browser can't compress videos"* | Quien envía necesita Chrome, Edge, Safari o Firefox actualizados (WebCodecs). |
| *"Too many attempts"* | Espera 15 minutos, o en Supabase → Table Editor → `rate_limits` borra las filas que empiezan por `login:` o `mfa:`. |
| Un moderador ya no debe entrar | *Edit* → **Regenerate** en la contraseña de Board Admin. |
| Error al subir fotos | Revisa que se ejecutó `schema.sql` (el bucket `room-media` debe existir) y que las claves de Supabase son correctas. |
| Las imágenes del deck dejan de verse tras horas abiertas | Las URLs firmadas caducan. La vista se refresca sola cada 30 min; también puedes pulsar ⟳. |
| La página de un board da 404 | El board está desactivado, no tiene streamer, su streamer está suspendido o la dirección no coincide. |
| Error `function … does not exist` tras actualizar | Vuelve a ejecutar `supabase/schema.sql` completo. |
| El registro de actividad está vacío | Revisa que ejecutaste el `schema.sql` nuevo (debe existir la tabla `audit_log`). |
| *"audit log entries can only be deleted after 365 days"* | Es intencionado: el registro no se puede borrar antes de tiempo. |

---

## Estructura del proyecto

```
supabase/schema.sql        Tablas, RLS, funciones atómicas y bucket privado
scripts/hash-password.mjs  Genera el hash de la contraseña de configuración
scripts/reset-owner.mjs    Vuelve a poner la contraseña de configuración al Owner
docs/                      Guía de uso (PDF, en inglés)
src/proxy.ts               CSP y primera barrera de acceso a las páginas privadas
src/actions/               Lógica de servidor (envío, login, boards, cuentas, streamers y equipos, problemas, idioma)
src/lib/                   Sesión y permisos, validación, rate limit, TOTP, auditoría, límites, Supabase, captcha
src/i18n/                  Idiomas: diccionarios y política de privacidad
src/components/            Interfaz
src/app/(site)/            Inicio y buscador, panel, streamers, equipo, admins, problemas, actividad, cuenta, login, setup, report, privacy, delete, contact
src/app/[streamer]/        Página pública de cada streamer y, en [board]/, la página, queue y deck de cada board
src/app/api/auth/twitch/   Entrada con Twitch (inicio y vuelta)
src/config/legal.ts        Tus datos legales, plazo de conservación y edad mínima
vercel.json                Cron diario de limpieza
```
