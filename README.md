# Stream Reviews

**English** · [Español](README.es.md)

A self-hosted web app for collecting photos from a community and reviewing them live on stream: room reviews, costume reviews, pet reviews and anything else. One installation hosts any number of **boards**, each with its own public page, its own streamer and its own moderation team.

It runs entirely on free plans: **Vercel Hobby**, **Supabase Free** and **Cloudflare Turnstile**.

📘 **How to use it:** see the [user guide (PDF)](docs/Stream-Reviews-User-Guide.pdf). This README covers installing and hosting your own copy.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Requirements](#requirements)
4. [Install locally](#1-install-locally)
5. [Set up Supabase](#2-set-up-supabase)
6. [Set up Cloudflare Turnstile](#3-set-up-cloudflare-turnstile)
7. [Secrets and the setup password](#4-secrets-and-the-setup-password)
8. [Your legal details](#5-your-legal-details)
9. [Run it locally](#6-run-it-locally)
10. [Deploy to Vercel](#7-deploy-to-vercel)
11. [Create the first Site Admin](#8-create-the-first-site-admin)
12. [Updating](#updating)
13. [Configuration reference](#configuration-reference)
14. [Security](#security)
15. [Privacy and data protection](#privacy-and-data-protection)
16. [Free plan limits](#free-plan-limits)
17. [Backups](#backups)
18. [Troubleshooting](#troubleshooting)
19. [Project structure](#project-structure)

---

## Features

- **Multiple boards**, each with a public link (`/pixelwitch-room-review`), a moderation queue and a live “deck” for the streamer.
- **Roles with closed registration:** Site Admin, Admin (own and shared boards), Board Admin (one board’s queue, by password) and Streamer (one board’s deck, by password).
- **No accounts for participants:** they send up to 5 photos and get a **deletion code** to remove them later.
- **Privacy by design:** photos are re-encoded in the browser (GPS/EXIF removed), stored privately and only shown through temporary links; emails never reach the deck; a blur key hides a photo instantly on stream.
- **Two-step verification** (TOTP) for accounts, one-time passwords for new accounts, regenerable board passwords that revoke access instantly.
- **Problem reports** from any page, and a tamper-proof **activity log** of what the team did.
- **Five languages:** English, Spanish, Portuguese, French and Japanese, with automatic detection.
- **Light and dark themes**, responsive from phones to wide screens.
- **GDPR-oriented:** consent records, layered information, automatic deletion after 90 days.

## How it works

```
Participant ──► /board          sends photos (no account)
                   │
Board Admin ──► /board/queue    approves or deletes
                   │
Streamer    ──► /board/deck     shows approved photos live
                   │
Daily job          ▼            deletes everything after 90 days
```

| Piece | Role |
|---|---|
| **Next.js 16** (App Router, server actions) on **Vercel** | Website and all server logic |
| **Supabase** (Postgres + Storage) | Database and private photo storage |
| **Cloudflare Turnstile** | Anti-bot check on submissions, sign-ins and reports |

The browser never talks to the database directly. Every read and write goes through the server with a secret key; the public key can’t read or write anything.

## Requirements

- **Node.js 20.9 or later** (22 LTS recommended) and **npm**
- **Git** and a **GitHub** account
- Free accounts on **Supabase** (<https://supabase.com>), **Vercel** (<https://vercel.com>) and **Cloudflare** (<https://dash.cloudflare.com>)

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

Check that **Table Editor** lists `boards`, `submissions`, `submission_media`, `rate_limits`, `admins`, `board_members`, `problem_reports` and `audit_log`, all marked **RLS enabled**, and that **Storage** has a **private** bucket called `room-media`.

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

## 4. Secrets and the setup password

### Setup password (`ADMIN_PASSWORD_HASH`)
This password is used **once**, at `/setup`, to create the first Site Admin. After that, the setup page disappears and the password no longer gives access to anything. Only its hash is stored:

```bash
npm run hash-password
```

Type a strong password (it isn’t shown) and copy the result, which starts with `scrypt:`, into `ADMIN_PASSWORD_HASH`. Keep the password itself somewhere safe until you’ve created the first account.

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

Open <http://localhost:3000>. You’ll be sent to the sign-in page with a link to **Set up the site**: follow [step 8](#8-create-the-first-site-admin). Stop the server with `Ctrl + C`.

Quick tour once you’re in:
1. **New board** → create a board. Both board passwords are generated for you.
2. Open the board’s public link in a private window and send a submission.
3. Open `/your-board/queue` in another private window with the **Board Admin password** and approve it.
4. Open `/your-board/deck` with the **streamer password**: that’s what the streamer sees.

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
   | `CRON_SECRET` | Random string |

4. Click **Deploy**.
5. Make sure your final domain is listed in your Turnstile widget’s **Hostnames**.

The daily clean-up (`vercel.json`, 04:00 UTC) is enabled automatically; Vercel sends `CRON_SECRET` with each run. It deletes incomplete uploads, expired submissions, old resolved problem reports and activity log entries older than a year. You’ll find it under **Settings → Cron Jobs**.

> After changing any environment variable in Vercel, **redeploy** so it takes effect.

## 8. Create the first Site Admin

1. Open `https://your-domain/setup`.
2. Enter the **setup password** (the one you hashed into `ADMIN_PASSWORD_HASH`), a username and a password for your account (12+ characters, not containing the username).
3. You’re signed in to the control panel. Go to **Account** and turn on **two-step verification**.
4. Create accounts for the rest of the team in **Admins**. Each person gets a one-time password valid for 72 hours.

From here on, the [user guide](docs/Stream-Reviews-User-Guide.pdf) explains every screen.

---

## Updating

1. Pull or copy the new version, keeping your `.env.local` and your details in `src/config/legal.ts`.
2. `npm install`
3. Run the **whole** `supabase/schema.sql` again in the Supabase SQL Editor.
4. Deploy (push to GitHub; Vercel redeploys automatically).

## Configuration reference

| Setting | Where | Default |
|---|---|---|
| Legal details, minimum age, retention | `src/config/legal.ts` | 18 years, 90 days |
| Photos per submission, size limit, description length | `src/lib/limits.ts` | 5 photos, 6 MB, 2,000 chars |
| Problem report retention | `src/lib/limits.ts` | 30 days after resolved, 365 max |
| Activity log retention | `src/lib/limits.ts` (`AUDIT_DAYS`) and `audit_log_guard` in `schema.sql` | 365 days |
| One-time password lifetime | `src/lib/accounts.ts` (`OTP_HOURS`) | 72 hours |
| Texts in each language | `src/i18n/dict/*.tsx` | — |
| Privacy policy in each language | `src/i18n/privacy/*.tsx` | — |
| Cron schedule | `vercel.json` | daily, 04:00 UTC |

If you change the photo size limit, also change `file_size_limit` for the bucket at the end of `schema.sql`. Each dictionary has the same type as the English one: if a translation is missing a text, the project won’t compile.

## Security

**Accounts and sessions**
- Closed registration: only a Site Admin creates accounts, with a one-time password (~99 bits) that expires in 72 hours and must be changed on first sign-in.
- Passwords (12+ characters) are hashed with scrypt and checked in constant time; unknown usernames are checked against a dummy hash so timing doesn’t reveal them.
- Optional **TOTP two-step verification**; the secret is encrypted and each code can be used once, enforced atomically in the database.
- Sessions are signed `__Host-` cookies (HS256 with an HKDF-derived key), `HttpOnly`, `Secure`, `SameSite=Strict`, 12 hours.
- The account is re-read from the database on every request: changing a password, role or two-step setting, or deleting the account, ends its sessions immediately. Board access carries the password version, so regenerating a board password revokes it at once.

**Access control**
- A proxy blocks private pages without a session, and **every page and every server action** checks the exact permission for that board again.
- The deck never receives emails. Site Admin pages return 404 to everyone else.

**Abuse protection**
- Turnstile on submissions, every sign-in, setup and problem reports; the server checks the token’s hostname and action.
- Atomic rate limits in Postgres (per IP, per account, per board and global). IPs are stored only as keyed hashes.

**Data and files**
- RLS enabled and forced with no policies; privileges revoked from `anon` and `authenticated`.
- Private bucket: uploads only through single-use signed URLs, viewing only through temporary signed URLs. Supabase rejects files over 6 MB or that aren’t JPEG, PNG or WebP, and the server checks each file’s real binary signature.
- Submissions and their photos are created in a single transaction; moderation actions are conditional updates, so concurrent moderators never overwrite each other.

**Accountability**
- Append-only `audit_log`, protected by Postgres triggers; even the secret key has no `UPDATE` privilege on it. It never stores participant data.

**HTTP headers**
- Per-request nonce **Content-Security-Policy** with `'strict-dynamic'`, plus HSTS, COOP/CORP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and `Permissions-Policy`. Private pages are `no-store` and `noindex`.

## Privacy and data protection

> ⚠️ Not legal advice. The project includes the technical pieces and policy texts written with the EU GDPR and Spain’s LOPDGDD in mind. Have a professional review them for your situation, especially for commercial use.

What’s already built in:
- Privacy policy and photo terms in five languages (`/privacy`), with a summary card for each kind of data: what, why, legal basis and how long.
- A review step before anything is sent, with layered information and four unticked consent boxes, checked on the server too.
- Consent records (date and policy version) and self-service deletion with a code.
- Automatic deletion after 90 days; problem reports and the activity log are also purged automatically.
- Only strictly necessary or user-requested cookies (session, two-step step, Turnstile, language), so no cookie banner is needed.

What you need to do:
1. Fill in `src/config/legal.ts` ([step 5](#5-your-legal-details)) and adapt the policy texts in `src/i18n/privacy/` if you’re outside Spain or the EU.
2. Accept the data processing agreements of Supabase, Vercel and Cloudflare.
3. Keep a record of processing activities (GDPR art. 30): submissions, problem reports and staff accounts with their activity log.
4. Answer access and deletion requests within one month.
5. Train your team with the privacy checklist in the user guide.

## Free plan limits

These change over time; check Supabase’s and Vercel’s pricing pages.

- **Supabase Free:** about **1 GB of file storage** (roughly 700 to 2,000 compressed photos). Projects **pause after about a week without activity**; the daily cron usually prevents it, and you can restore a paused project from the dashboard.
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
| *This one-time password has expired* | A Site Admin must use **Reset password** on that account. |
| The only Site Admin lost their two-step device | In the Supabase SQL Editor: `update admins set totp_secret_enc = null, totp_enabled_at = null, session_version = session_version + 1 where username = 'their_username';` |
| *Too many attempts* | Wait 15 minutes, or delete rows starting with `login:` or `mfa:` from the `rate_limits` table. |
| Photo upload fails | Check that `schema.sql` ran (the `room-media` bucket must exist) and that the Supabase keys are correct. |
| `function … does not exist` after updating | Run the whole `supabase/schema.sql` again. |
| *audit log entries can only be deleted after 365 days* | Intended: the activity log can’t be deleted early. |
| Supabase errors after days without use | The project is paused. Restore it from the dashboard. |

## Project structure

```
supabase/schema.sql        Tables, RLS, atomic functions, audit log and private bucket
scripts/hash-password.mjs  Generates the setup password hash
docs/                      User guide (PDF)
src/proxy.ts               CSP and first access barrier for private pages
src/actions/               Server logic: submissions, sign-in, boards, accounts, problems, language
src/lib/                   Sessions and permissions, validation, rate limits, TOTP, audit, limits
src/i18n/                  Languages: dictionaries and privacy policy
src/components/            User interface
src/app/(site)/            Control panel, admins, problems, activity, account, sign-in, setup, report, privacy, delete, contact
src/app/[slug]/            Each board’s public page, queue and deck
src/config/legal.ts        Your legal details, retention and minimum age
vercel.json                Daily clean-up job
```
