# Supabase setup — exact steps

About 5–10 minutes. Everything the app needs is in `schema.sql`; this guide is the
clicking-around part that has to happen in the Supabase dashboard.

## 1. Create the project

1. Go to https://supabase.com → sign in (GitHub login is fine) → **New project**.
2. Name: `jabkozdarma`. Region: **Central EU (Frankfurt)** — closest to Czech users.
3. It generates a **database password** — save it in your password manager. The app
   never uses it (it authenticates with the anon key + RLS); you'd only need it for
   direct `psql` access later.
4. Wait ~2 minutes while the project provisions.

## 2. Run the schema

1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the **entire** contents of [`schema.sql`](schema.sql) → **Run** (Cmd/Ctrl+Enter).
3. Expected output: `Success. No rows returned`.

That one script creates: the PostGIS extension, 4 enums, 6 tables (`profiles`,
`trees`, `tree_photos`, `reports`, `flags`, `favorites`), the trigger that
auto-creates a profile on signup, the spatial index, the `trees_in_bbox` viewport
RPC, row-level security policies on every table, and the public `tree-photos`
storage bucket with its policies.

Check it worked: **Database → Tables** should list all 6 tables.

> ⚠️ The script assumes a fresh project and is not re-runnable (`create type` /
> `create table` fail if they already exist). If it errors partway, don't re-run it
> blindly — note the error and get a cleanup script for exactly the part that ran.

## 3. Fix the OTP email template (the one real gotcha)

The app signs users in with a **6-digit emailed code**. Supabase's default "Magic
Link" template sends a *link* and no code, so out of the box the email is useless
to the app.

1. **Authentication → Email Templates → Magic Link**.
2. Replace the body with something like:

   ```html
   <h2>JabkoZdarma</h2>
   <p>Your sign-in code / Váš přihlašovací kód:</p>
   <h1>{{ .Token }}</h1>
   <p>It expires in 1 hour. / Platí 1 hodinu.</p>
   ```

   The required part is `{{ .Token }}` — that's the 6-digit code.
3. Save. No other auth settings need changing (Email provider is on by default).

Note on volume: the built-in mailer is heavily rate-limited (a few emails per
hour) — fine for testing, but plug in custom SMTP (Resend's free tier works,
**Authentication → SMTP Settings**) before telling other people about the app.

## 4. Copy the two values

**Project Settings (gear) → API**:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** API key (newer dashboards may label it **publishable**,
  `sb_publishable_…` — either works)

The anon key is safe to expose in the client — every table is guarded by RLS.

## 5. Wire the app

**Local dev:**

```bash
cp .env.example .env   # then paste the two values into it
```

Restart the dev server afterwards — env vars are baked in at bundle time, a running
server won't pick them up.

**Production (GitHub Pages):**

```bash
gh variable set EXPO_PUBLIC_SUPABASE_URL --repo N041M/jabkozdarma
gh variable set EXPO_PUBLIC_SUPABASE_ANON_KEY --repo N041M/jabkozdarma
gh workflow run deploy.yml --repo N041M/jabkozdarma
```

## 6. First sign-in + seed the map

A fresh database is **empty** — the Prague demo pins you saw are local-mode-only.

1. Open the app → Profile → pick a username, enter your email → **Email me a code**
   → type the 6-digit code from the mail.
2. Verify: **Authentication → Users** shows your account, and **Table Editor →
   profiles** has your row.
3. Optional: to start the map with the five Prague pins, run
   [`seed.sql`](seed.sql) in the SQL Editor **after** that first sign-in (it
   attaches the pins to the first profile in the database).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Email arrives with a link, no code | Step 3 skipped — template needs `{{ .Token }}` |
| "email rate limit exceeded" | Built-in mailer cap — wait an hour or set custom SMTP |
| App still says "Local mode" | Env vars not baked in — restart dev server / re-run deploy after setting variables |
| Map is empty after connecting | Expected on a fresh DB — sign in and add a tree, or run `seed.sql` |
| Schema run fails midway | Project wasn't fresh, or partial rerun — don't re-run; get a targeted cleanup script |
