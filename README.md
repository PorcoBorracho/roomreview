# Stream Reviews

**English** · [Español](README.es.md)

Proyect made using Claude.

A self-hosted web app for collecting photos (and short videos) from a community and reviewing them live on stream: room reviews, costume reviews, pet reviews and anything else. One installation hosts any number of **streamers**, who sign in with Twitch, each with their own public page, their own **boards** and their own moderation team.

It runs entirely on free plans: **Vercel Hobby**, **Supabase Free**, **Cloudflare Turnstile** and a **Twitch** developer application.

📘 **How to use it:** see the [user guide (PDF)](docs/Stream-Reviews-User-Guide.pdf). This README covers installing and hosting your own copy.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Requirements](#requirements)
4. [Install locally](#1-install-locally)
5. [Set up Supabase](#2-set-up-supabase)
6. [Set up Cloudflare Turnstile](#3-set-up-cloudflare-turnstile)
7. [Set up Twitch sign-in](#3b-set-up-twitch-sign-in)
8. [Secrets and the setup password](#4-secrets-and-the-setup-password)
9. [Your legal details](#5-your-legal-details)
10. [Run it locally](#6-run-it-locally)
11. [Deploy to Vercel](#7-deploy-to-vercel)
12. [Create the Owner account](#8-create-the-owner-account)
13. [Roles](#roles)
14. [Updating](#updating)
15. [Configuration reference](#configuration-reference)
16. [Security](#security)
17. [Privacy and data protection](#privacy-and-data-protection)
18. [Free plan limits](#free-plan-limits)
19. [Backups](#backups)
20. [Troubleshooting](#troubleshooting)
21. [Project structure](#project-structure)

---

## Features

- **Streamers sign in with Twitch** (approved by a Site Admin), get a public page (`/pixelwitch`) listing their boards, and visitors can **search streamers** from the home page.
- **Multiple boards per streamer**, each with a public link (`/pixelwitch/room-review`), a moderation queue and a live “deck” for the streamer.
- **Roles:** Owner, Site Admin, Admin, Streamer, plus password-only Board Admin (queue) and deck access. See [Roles](#roles).
- **No accounts for participants:** they send up to 5 files (photos and, if the board allows it, one video) and get a **deletion code** to remove them later.
- **Privacy by design:** photos are re-encoded in the browser (GPS/EXIF removed), videos are compressed in the browser (720p, no sound, no metadata, 60 s max); everything is stored privately and only shown through temporary links; emails never reach the deck; each review starts **blurred** on the deck until the streamer reveals it.
- **Two-step verification** (TOTP, required for the Owner), one-time passwords for new accounts, regenerable board passwords that revoke access instantly.
- **Problem reports** from any page, and a tamper-proof **activity log** of what the team did.
- **Five languages:** English, Spanish, Portuguese, French and Japanese, with automatic detection.
- **Light and dark themes**, responsive from phones to wide screens.
- **GDPR-oriented:** consent records, layered information, automatic deletion after 90 days.

## How it works

```
Visitor     ──► /                         searches for a streamer
                   │
Participant ──► /streamer/board           sends photos or a video (no account)
                   │
Admin team  ──► /streamer/board/queue     approves or deletes
                   │
Streamer    ──► /streamer/board/deck      shows approved submissions live
                   │
Daily job          ▼                      deletes everything after 90 days
```

| Piece | Role |
|---|---|
| **Next.js 16** (App Router, server actions) on **Vercel** | Website and all server logic |
| **Supabase** (Postgres + Storage) | Database and private photo storage |
| **Cloudflare Turnstile** | Anti-bot check on submissions, sign-ins and reports |
| **Twitch** (OAuth) | Identity of streamers |

The browser never talks to the database directly. Every read and write goes through the server with a secret key; the public key can’t read or write anything.

## Requirements

- **Node.js 20.9 or later** (22 LTS recommended) and **npm**
- **Git** and a **GitHub** account
- Free accounts on **Supabase** (<https://supabase.com>), **Vercel** (<https://vercel.com>), **Cloudflare** (<https://dash.cloudflare.com>) and a **Twitch** account with two-factor authentication enabled (required to register an application)

---

## 1. Install locally

```bash
git clone https://github.com/YOUR_USER/room-review.git
cd room-review
npm install
cp .env.example .env.local      # Windows PowerShell: copy .env.example .env.local
```

You’ll fill in `.env.local` over the next steps.

## 2. Set up Supabase

### 2.1 Create the project
1. In <https://supabase.com/dashboard>, click **New project**.
2. Choose a name, a strong database password, and a **region close to your users**. If you’re in the EU, pick an EU region (for example *Central EU (Frankfurt)*); it makes GDPR compliance simpler, and the region **can’t be changed later**.

### 2.2 Create the tables, security and photo bucket
1. Open **SQL Editor → New query**.
2. Paste the **whole** content of `supabase/schema.sql` and click **Run**. It must finish without errors.
3. The script is idempotent: run it again after every update, it never deletes data.

Check that **Table Editor** lists `boards`, `submissions`, `submission_media`, `rate_limits`, `admins`, `board_members`, `streamer_admins`, `problem_reports` and `audit_log`, all marked **RLS enabled**, and that **Storage** has a **private** bucket called `room-media`.

> The bucket accepts files up to 20 MB (for videos). The **Supabase Free** plan allows up to 50 MB per file, so this works; if your project has a lower *Upload file size limit* in **Storage → Settings**, raise it to at least 20 MB.

> Don’t add RLS policies or make the bucket public. That’s the design: public keys can’t access anything, and everything goes through the server.

### 2.3 Copy the keys
In **Project Settings → API Keys**:

| In Supabase | Variable in `.env.local` |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`) or legacy **anon** key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (`sb_secret_…`) or legacy **service_role** key | `SUPABASE_SECRET_KEY` |

> 🔒 The secret key gives full access. Never put it in code, screenshots or any variable starting with `NEXT_PUBLIC_`.

## 3. Set up Cloudflare Turnstile

`.env.example` already contains Cloudflare’s official **test keys**, which always pass, so you can skip this step for local development. For production:

1. <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Add your domain under **Hostnames** (for example `your-project.vercel.app`, plus `localhost` if you want).
3. Mode: **Managed**.
4. Copy the **Site Key** to `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret Key** to `TURNSTILE_SECRET_KEY`.

## 3b. Set up Twitch sign-in

Streamers sign in with Twitch. The site only reads their public identity (ID, name and picture): it asks for no permissions and doesn’t keep any Twitch token.

1. Open <https://dev.twitch.tv/console/apps> and click **Register Your Application** (Twitch requires two-factor authentication on your account for this).
2. **Name:** anything unique, for example *Stream Reviews – your-domain*.
3. **OAuth Redirect URLs:** add `https://your-domain/api/auth/twitch/callback` and, for local development, `http://localhost:3000/api/auth/twitch/callback`. They must match exactly.
4. **Category:** *Website Integration*. **Client Type:** *Confidential*.
5. Create it, then copy the **Client ID** to `TWITCH_CLIENT_ID`, click **New Secret** and copy it to `TWITCH_CLIENT_SECRET`.

Without these variables the site still works, but streamers can’t sign in (Site Admins see a warning on the **Streamers** page).

> Vercel preview deployments use a different URL that isn’t registered in Twitch, so test Twitch sign-in on your production domain or locally.

## 4. Secrets and the setup password

### Setup password (`ADMIN_PASSWORD_HASH`)
This password is used at `/setup` to create the **Owner** (the first Site Admin). After that, the setup page disappears. It’s used again only if the Owner’s password is reset ([Roles](#roles)), so keep it somewhere safe. Only its hash is stored:

```bash
npm run hash-password
```

Type a strong password (it isn’t shown) and copy the result, which starts with `scrypt:`, into `ADMIN_PASSWORD_HASH`. Keep the password itself in a password manager.

### Session and cron secrets
Generate two random strings (run the command twice):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- First one → `SESSION_SECRET`. It signs sessions and, through derived keys, encrypts board passwords and two-step keys.
- Second one → `CRON_SECRET`. It protects the daily clean-up job.

> ⚠️ Changing `SESSION_SECRET` later signs everyone out, makes board passwords impossible to copy (regenerate them) and locks out accounts with two-step verification until a Site Admin resets their password. Set it once and keep it.

## 5. Your legal details

The site shows a privacy policy and contact page, which must name whoever runs it. Edit **`src/config/legal.ts`**:

| Field | What to put |
|---|---|
| `controllerName` | Your name or your organisation’s legal name |
| `controllerTaxId` | Tax ID (optional for individuals) |
| `controllerAddress` | Postal address, or at least city and country |
| `contactEmail` | A working email for privacy requests |
| `projectName` | The site name shown in the header (default *Stream Reviews*) |
| `databaseRegion` | The Supabase region you chose |
| `authorityName`, `authorityUrl` | Your data protection authority (default: Spain’s AEPD) |
| `minAge` | Minimum age to submit (default 18; lowering it is not recommended) |
| `retentionDays` | Days before submissions are deleted (default 90) |
| `policyVersion` | Bump it (`YYYY-MM-DD.n`) whenever you change the privacy texts |

While the name, address or email still contain the `[placeholder]` values, a yellow warning appears in the footer during local development.

> 💡 If your repository is public and you’d rather not commit these details, change those fields to read from `NEXT_PUBLIC_…` environment variables (they’re shown publicly on the site anyway) and set them in `.env.local` and in Vercel.

## 6. Run it locally

```bash
npm run dev
```

Open <http://localhost:3000> and click **Sign in**. You’ll see a link to **Set up the site**: follow [step 8](#8-create-the-owner-account). Stop the server with `Ctrl + C`.

Quick tour once you’re in:
1. In a private window, **Continue with Twitch** with a streamer account: it becomes a request.
2. As the Owner, open **Streamers** and approve it.
3. Back in the private window, continue with Twitch again: the streamer creates a board and, in **Team**, adds up to two Admins.
4. Open the board’s public link (`/streamer/board`) in another window and send a submission.
5. An Admin of the team (or anyone with the **Board Admin password**) approves it in the queue.
6. The streamer opens the deck: each review starts blurred until they click **Reveal**.

## 7. Deploy to Vercel

1. Push the project to a GitHub repository (**private** recommended). `.env.local` is in `.gitignore` and must never be committed.
2. <https://vercel.com/new> → **Import** the repository. The framework (Next.js) is detected automatically; don’t change the build settings.
3. Under **Environment Variables**, add every variable from `.env.local` with its production value:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key |
   | `SUPABASE_SECRET_KEY` | Secret / service_role key |
   | `ADMIN_PASSWORD_HASH` | `scrypt:…` (setup password) |
   | `SESSION_SECRET` | Random string |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Your real Turnstile site key |
   | `TURNSTILE_SECRET_KEY` | Your real Turnstile secret key |
   | `TWITCH_CLIENT_ID` | Twitch application Client ID |
   | `TWITCH_CLIENT_SECRET` | Twitch application secret |
   | `CRON_SECRET` | Random string |

   Vercel may suggest removing the `NEXT_PUBLIC_` prefix from some keys: they are public by design (shown in the browser), so keep the prefix and mark them as **Config**. Mark the rest as **Sensitive**.

4. Click **Deploy**.
5. Make sure your final domain is listed in your Turnstile widget’s **Hostnames**, and its Twitch callback in your Twitch application’s **OAuth Redirect URLs**.

The daily clean-up (`vercel.json`, 04:00 UTC) is enabled automatically; Vercel sends `CRON_SECRET` with each run. It deletes incomplete uploads, expired submissions, old resolved problem reports, streamer requests nobody approved in 30 days and activity log entries older than a year. You’ll find it under **Settings → Cron Jobs**.

> After changing any environment variable in Vercel, **redeploy** so it takes effect.

## 8. Create the Owner account

1. Open `https://your-domain/setup`.
2. Enter the **setup password** (the one you hashed into `ADMIN_PASSWORD_HASH`), a username and a password for your account (12+ characters, not containing the username).
3. You’re now the **Owner**. Before anything else, turn on **two-step verification**: it’s required for this account and the panel stays locked until it’s on.
4. Create accounts for the rest of the staff in **Admins** (each gets a one-time password valid for 72 hours), and approve streamers in **Streamers** as they sign in with Twitch.

From here on, the [user guide](docs/Stream-Reviews-User-Guide.pdf) explains every screen.

## Roles

| Role | How they sign in | What they can do |
|---|---|---|
| **Owner** | Username, password and **required** two-step code | Everything a Site Admin can. The first account created at `/setup`; can’t be demoted or deleted. |
| **Site Admin** | Username and password (+ optional 2-step) | All boards, approve and suspend streamers, manage any streamer’s team, create staff accounts and give or remove the Site Admin role, problem reports, activity log. |
| **Admin** | Username and password (+ optional 2-step) | Boards they created or that are shared with them, and **all boards of the streamers whose team they’re in**; can only create boards for those streamers. Moderates queues. |
| **Streamer** | **Twitch** (needs a Site Admin’s approval the first time) | Creates and edits their own boards and opens their **deck**, but not the queue. Their **team** can have up to **2 Admins**: they create new Admin accounts (one-time password) or add existing ones. |
| **Board Admin** | A board’s queue password, no account | That board’s queue and deck. |
| Deck access | A board’s streamer password, no account | That board’s deck (useful for OBS or another computer). |

**Owner password reset.** The Owner’s password can only go back to the **setup password** (`ADMIN_PASSWORD_HASH`); nobody else can reset it:
- signed in: **Account → Reset to the setup password** (asks for a current two-step code);
- locked out: on a computer with the project and the production values of `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `ADMIN_PASSWORD_HASH` in `.env.local`, run

  ```bash
  npm run reset-owner                 # keeps two-step verification
  npm run reset-owner -- --clear-2fa  # also removes it (lost phone); it must be set up again after signing in
  ```

Either way all of the Owner’s sessions end, and they must sign in within 72 hours with the setup password and choose a new one.

---

## Updating

1. Pull or copy the new version, keeping your `.env.local` and your details in `src/config/legal.ts`.
2. `npm install`
3. Run the **whole** `supabase/schema.sql` again in the Supabase SQL Editor.
4. Deploy (push to GitHub; Vercel redeploys automatically).

**Upgrading from the version without streamer accounts:** the oldest Site Admin becomes the **Owner** and must turn on two-step verification at the next sign-in. Board addresses change from `/board` to `/streamer/board`: existing boards appear in the panel as *No streamer set* until a Site Admin edits each one and chooses its streamer (once that streamer has signed in with Twitch and been approved). Add the Twitch variables ([step 3b](#3b-set-up-twitch-sign-in)), and bump `policyVersion` in your `src/config/legal.ts` because the privacy texts changed.

## Configuration reference

| Setting | Where | Default |
|---|---|---|
| Legal details, minimum age, retention | `src/config/legal.ts` | 18 years, 90 days |
| Files per submission, photo size, description length | `src/lib/limits.ts` | 5 files, 6 MB, 2,000 chars |
| Videos: per submission, size, length | `src/lib/limits.ts` (`MAX_VIDEOS`, `MAX_VIDEO_BYTES`, `MAX_VIDEO_SECONDS`) and `create_submission` in `schema.sql` | 1 video, 20 MB, 60 s |
| Admins per streamer team | `src/lib/limits.ts` (`MAX_TEAM`) and `schema.sql` | 2 |
| Pending streamer requests (max, days kept) | `src/lib/limits.ts` | 200, 30 days |
| Problem report retention | `src/lib/limits.ts` | 30 days after resolved, 365 max |
| Activity log retention | `src/lib/limits.ts` (`AUDIT_DAYS`) and `audit_log_guard` in `schema.sql` | 365 days |
| One-time password lifetime | `src/lib/accounts.ts` (`OTP_HOURS`) | 72 hours |
| Texts in each language | `src/i18n/dict/*.tsx` | — |
| Privacy policy in each language | `src/i18n/privacy/*.tsx` | — |
| Cron schedule | `vercel.json` | daily, 04:00 UTC |

If you change the video size limit, also change `file_size_limit` for the bucket at the end of `schema.sql`. Each dictionary has the same type as the English one: if a translation is missing a text, the project won’t compile.

## Security

**Accounts and sessions**
- Closed registration for staff: only a Site Admin (or a streamer, for at most two Admins in their own team) creates accounts, with a one-time password (~99 bits) that expires in 72 hours and must be changed on first sign-in.
- Streamers sign in with Twitch (OAuth authorization code flow with a signed, single-use `state` cookie; no scopes requested, the token is revoked right after reading the profile) and need a Site Admin’s approval. Suspending a streamer ends their session at once and hides their pages.
- The Owner can’t be demoted, deleted or reset by anyone else, and two-step verification is mandatory for it.
- Passwords (12+ characters) are hashed with scrypt and checked in constant time; unknown usernames are checked against a dummy hash so timing doesn’t reveal them.
- **TOTP two-step verification** (optional, required for the Owner); the secret is encrypted and each code can be used once, enforced atomically in the database.
- Sessions are signed `__Host-` cookies (HS256 with an HKDF-derived key), `HttpOnly`, `Secure`, `SameSite=Strict`, 12 hours.
- The account is re-read from the database on every request: changing a password, role or two-step setting, or deleting the account, ends its sessions immediately. Board access carries the password version, so regenerating a board password revokes it at once.

**Access control**
- A proxy blocks private pages without a session, and **every page and every server action** checks the exact permission for that board again.
- The deck never receives emails, and streamers can’t open the queue. Site Admin pages return 404 to everyone else.
- Team limits (2 Admins per streamer) and the video rule (only if the board allows it, at most one) are enforced inside Postgres transactions, so parallel requests can’t exceed them.

**Abuse protection**
- Turnstile on submissions, every sign-in, setup and problem reports; the server checks the token’s hostname and action.
- Atomic rate limits in Postgres (per IP, per account, per board and global). IPs are stored only as keyed hashes.

**Data and files**
- RLS enabled and forced with no policies; privileges revoked from `anon` and `authenticated`.
- Private bucket: uploads only through single-use signed URLs, viewing only through temporary signed URLs. Supabase rejects files over 20 MB or that aren’t JPEG, PNG, WebP, MP4 or WebM; the server checks each file’s real binary signature and size (6 MB for photos).
- Submissions and their photos are created in a single transaction; moderation actions are conditional updates, so concurrent moderators never overwrite each other.

**Accountability**
- Append-only `audit_log`, protected by Postgres triggers; even the secret key has no `UPDATE` privilege on it. It never stores participant data.

**HTTP headers**
- Per-request nonce **Content-Security-Policy** with `'strict-dynamic'` (images only from your Supabase project and Twitch’s avatar CDN), plus HSTS, COOP/CORP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and `Permissions-Policy`. Private pages are `no-store` and `noindex`.

## Privacy and data protection

> ⚠️ Not legal advice. The project includes the technical pieces and policy texts written with the EU GDPR and Spain’s LOPDGDD in mind. Have a professional review them for your situation, especially for commercial use.

What’s already built in:
- Privacy policy and photo terms in five languages (`/privacy`), with a summary card for each kind of data: what, why, legal basis and how long.
- A review step before anything is sent, with layered information and four unticked consent boxes, checked on the server too.
- Consent records (date and policy version) and self-service deletion with a code.
- Automatic deletion after 90 days; problem reports and the activity log are also purged automatically.
- Only strictly necessary or user-requested cookies (session, two-step step, Twitch sign-in check, Turnstile, language), so no cookie banner is needed.
- Streamer accounts store only the Twitch ID, login, display name and picture link.

What you need to do:
1. Fill in `src/config/legal.ts` ([step 5](#5-your-legal-details)) and adapt the policy texts in `src/i18n/privacy/` if you’re outside Spain or the EU.
2. Accept the data processing agreements of Supabase, Vercel and Cloudflare, and the Twitch Developer Agreement.
3. Keep a record of processing activities (GDPR art. 30): submissions, problem reports, streamer accounts and staff accounts with their activity log.
4. Answer access and deletion requests within one month.
5. Train your team with the privacy checklist in the user guide.

## Free plan limits

These change over time; check Supabase’s and Vercel’s pricing pages.

- **Supabase Free:** about **1 GB of file storage** (roughly 700 to 2,000 compressed photos; a one-minute video takes about 11 MB, so enable videos only on boards that need them). Projects **pause after about a week without activity**; the daily cron usually prevents it, and you can restore a paused project from the dashboard.
- **Vercel Hobby:** **non-commercial use only**, and cron jobs run once a day. For commercial use, move to a paid plan.

## Backups

The Supabase free plan doesn’t include downloadable backups. To export the database manually:

```bash
docker run --rm postgres:17 pg_dump "YOUR_SESSION_POOLER_CONNECTION_STRING" --schema=public --data-only > backup.sql
```

Get the connection string from Supabase → **Connect** → *Session pooler*. The backup contains emails and password hashes: keep it private. Photos aren’t included; download them from Supabase → Storage if needed.

## Troubleshooting

| Problem | Solution |
|---|---|
| `Missing environment variable …` | Add that variable to `.env.local` or Vercel, then restart or redeploy. |
| Turnstile doesn’t appear or always fails | Your domain isn’t in the widget’s Hostnames, or you’re using test keys in production. |
| `/setup` says *Incorrect password* | It expects the password whose hash is in `ADMIN_PASSWORD_HASH`. If the hash was copied incompletely (it has 6 parts separated by `:`), generate it again. |
| `/setup` redirects to sign-in | An account already exists. Sign in with it. |
| *This one-time password has expired* | A Site Admin must use **Reset password** on that account. For the Owner, run `npm run reset-owner` again. |
| The Owner forgot their password or lost their two-step device | `npm run reset-owner` (add `-- --clear-2fa` if the phone is lost). See [Roles](#roles). |
| A Site Admin lost their two-step device | Another Site Admin or the Owner uses **Reset password** on that account (it also removes two-step verification). |
| *Twitch sign-in isn’t set up on this site yet* | Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` and redeploy. |
| Twitch shows *redirect_mismatch* | The callback URL in your Twitch application must be exactly `https://your-domain/api/auth/twitch/callback`. |
| A streamer only sees *waiting for approval* | A Site Admin must approve them in **Streamers**. |
| *Your browser can’t compress videos* | The participant needs an up-to-date Chrome, Edge, Safari or Firefox (WebCodecs). |
| *Too many attempts* | Wait 15 minutes, or delete rows starting with `login:` or `mfa:` from the `rate_limits` table. |
| Photo upload fails | Check that `schema.sql` ran (the `room-media` bucket must exist) and that the Supabase keys are correct. |
| `function … does not exist` after updating | Run the whole `supabase/schema.sql` again. |
| *audit log entries can only be deleted after 365 days* | Intended: the activity log can’t be deleted early. |
| Supabase errors after days without use | The project is paused. Restore it from the dashboard. |

## Project structure

```
supabase/schema.sql        Tables, RLS, atomic functions, audit log and private bucket
scripts/hash-password.mjs  Generates the setup password hash
scripts/reset-owner.mjs    Resets the Owner's password to the setup password
docs/                      User guide (PDF)
src/proxy.ts               CSP and first access barrier for private pages
src/actions/               Server logic: submissions, sign-in, boards, accounts, streamers and teams, problems, language
src/lib/                   Sessions and permissions, validation, rate limits, TOTP, audit, limits
src/i18n/                  Languages: dictionaries and privacy policy
src/components/            User interface
src/app/(site)/            Home and streamer search, control panel, streamers, team, admins, problems, activity, account,
                           sign-in, setup, report, privacy, delete, contact
src/app/[streamer]/        Each streamer’s public page, and [board]/ with the board’s page, queue and deck
src/app/api/auth/twitch/   Twitch sign-in (start and callback)
src/config/legal.ts        Your legal details, retention and minimum age
vercel.json                Daily clean-up job
```
