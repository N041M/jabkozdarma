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

## 3. Allow the app's URLs for the sign-in link

The app signs users in with the **magic link** from Supabase's default email
(the built-in mailer's templates can't be edited, so there's no code in the
mail — the app detects the session from the link redirect instead). Supabase
only redirects to allow-listed URLs:

1. **Authentication → URL Configuration**.
2. **Site URL**: `https://n041m.github.io/jabkozdarma/`
3. **Redirect URLs** — add both:
   - `https://n041m.github.io/jabkozdarma/**`
   - `http://localhost:8081/**`

Nothing else in auth settings needs changing (Email provider is on by default).

Later, before real launch: set up custom SMTP (**Authentication → SMTP
Settings**; Resend's free tier works). That lifts the built-in mailer's harsh
rate limit (a few emails per hour) **and** unlocks editable templates — add
`{{ .Token }}` to the Magic Link template and the app's "code from the email"
field starts working as an alternative to tapping the link.

## 3b. Google sign-in (recommended — no emails at all)

One tap, no inbox round-trip, and it sidesteps email rate limits entirely.

**In Google Cloud Console** (console.cloud.google.com):

1. Create a project named `jabkozdarma` (top-left project picker → New project).
2. **APIs & Services → OAuth consent screen** → User type **External** → fill in
   app name `JabkoZdarma`, your email for both support and developer contact →
   Save. Leave scopes empty (email + profile are included by default).
   While it stays in **Testing**, only accounts listed under "Test users" can
   sign in — hit **Publish app** when you want it open to everyone. Basic
   email/profile scopes don't require Google's verification review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → Application type **Web application**:
   - **Authorized JavaScript origins**: `https://n041m.github.io` and
     `http://localhost:8081`
   - **Authorized redirect URI** — this is Supabase's callback, *not* the app URL,
     and getting it wrong is the usual failure:
     `https://lpipnyievajqvapcpcoy.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

**In Supabase**: **Authentication → Sign In / Providers → Google** → enable it,
paste the client ID and secret → Save. The "Continue with Google" button in the
app starts working immediately; no redeploy needed.

## 3c. Custom SMTP with Brevo (lifts the email rate limit)

Supabase's built-in mailer allows only a couple of emails per hour and its
templates are locked. Brevo's free tier (~300/day) works without owning a
domain — it verifies a single sender address instead.

1. Create a free account at brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: your name and
   the address the app should send from. Brevo emails you a confirmation link —
   click it, or nothing will send.
3. **SMTP & API → SMTP tab** → note the server (`smtp-relay.brevo.com`), port
   `587`, and your **SMTP login**, then **Generate a new SMTP key** and copy it.
4. **Supabase → Authentication → Emails → SMTP Settings** → enable custom SMTP:
   - Sender email: the address you verified in step 2
   - Sender name: `JabkoZdarma`
   - Host: `smtp-relay.brevo.com`   Port: `587`
   - Username: your Brevo SMTP login   Password: the SMTP key
5. **Authentication → Rate Limits** → raise "Emails per hour" (100 is plenty).

Two things follow from this: email templates become editable (add `{{ .Token }}`
to the Magic Link template if you want code-based login back), and deliverability
depends on the sender address. A free webmail sender can't be DKIM-signed, so
some mail will land in spam — for launch, register a domain and verify that
instead.

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

1. Open the app → Profile → pick a username, enter your email → **Email me a
   sign-in link** → open the email *on the same device/browser* and tap **Sign in**.
2. Verify: **Authentication → Users** shows your account, and **Table Editor →
   profiles** has your row.
3. Optional: to start the map with the five Prague pins, run
   [`seed.sql`](seed.sql) in the SQL Editor **after** that first sign-in (it
   attaches the pins to the first profile in the database).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Link in email says "requested path is invalid" | Step 3 skipped — the app URL isn't in Redirect URLs |
| Tapping the link doesn't sign you in | Link was opened in a different browser than the app — open the email on the same device/browser |
| "email rate limit exceeded" | Built-in mailer cap (a couple per hour) — wait, or set up Brevo (3c) |
| Google button → "redirect_uri_mismatch" | The Cloud Console redirect URI must be the Supabase `/auth/v1/callback` URL, not the app URL |
| Google sign-in says the app is blocked | OAuth consent screen still in Testing — add the account under Test users, or Publish the app |
| Brevo mail never arrives | Sender address not confirmed (Brevo sends a verification link), or it landed in spam |
| App still says "Local mode" | Env vars not baked in — restart dev server / re-run deploy after setting variables |
| Map is empty after connecting | Expected on a fresh DB — sign in and add a tree, or run `seed.sql` |
| Schema run fails midway | Project wasn't fresh, or partial rerun — don't re-run; get a targeted cleanup script |
