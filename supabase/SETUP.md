# Set up Supabase

This guide takes about 5 to 10 minutes. Everything the app needs from the database is
in [`schema.sql`](schema.sql); what follows is the part you have to do by hand in the
Supabase dashboard.

## Create the project

1. Go to [supabase.com](https://supabase.com) and sign in. A GitHub login works.
2. Click **New project**.
3. Name the project `jabkozdarma` and choose the **Central EU (Frankfurt)** region,
   which is the closest one to Czech users.
4. Save the generated **database password** in your password manager. The app never
   uses it, because it authenticates with the anon key and row-level security (RLS).
   You need the password only for direct `psql` access later.
5. Wait about two minutes while Supabase provisions the project.

## Run the schema

1. In the sidebar, go to **SQL Editor > New query**.
2. Paste the entire contents of [`schema.sql`](schema.sql) and click **Run**, or press
   Command+Enter or Control+Enter.
3. Confirm that the output reads `Success. No rows returned`.

That one script creates the following:

- The PostGIS extension
- Four enums
- Seven tables: `profiles`, `trees`, `tree_photos`, `reports`, `tree_confirmations`,
  `flags`, and `favorites`
- The trigger that creates a profile when someone signs up
- The spatial index
- The `trees_in_bbox` viewport RPC
- Row-level security policies on every table
- The public `tree-photos` storage bucket and its policies

To verify the run, go to **Database > Tables** and confirm that all seven tables appear.

### Add the verification rules

`schema.sql` creates the tables, but the rules that decide who may write a pin and
whether the map trusts it live in
[`migration-003-verification.sql`](migration-003-verification.sql). Run that file next,
in a new query, then [`migration-004-placement.sql`](migration-004-placement.sql). Every
project needs both, fresh or not — without 003, new pins go live unchecked and the tree
detail screen can't confirm anything; without 004, the app can't add a pin at all,
because it writes a column that doesn't exist yet. For what they enforce, see
[Verification](#verification).

Unlike `schema.sql`, both are safe to run again.

**Caution:** The script assumes a fresh project, and you can't run it twice.
`create type` and `create table` both fail if the object already exists. If the script
fails partway through, don't run it again. Note the error, and write a cleanup script
for the part that already ran.

## Allow the app's URLs for the sign-in link

The app signs people in with the **magic link** in Supabase's default email. You can't
edit the built-in mailer's templates, so the mail carries no code. Instead, the app
detects the session from the link's redirect. Supabase redirects only to URLs you
allow, so add yours:

1. Go to **Authentication > URL Configuration**.
2. Set **Site URL** to `https://n041m.github.io/jabkozdarma/`.
3. Under **Redirect URLs**, add both of these:
   - `https://n041m.github.io/jabkozdarma/**`
   - `http://localhost:8081/**`

Nothing else in the auth settings needs to change. The email provider is on by default.

Before a real launch, set up custom SMTP under **Authentication > SMTP Settings**.
Resend's free tier works. Custom SMTP lifts the built-in mailer's rate limit of a few
emails an hour, and it also lets you edit the templates. Once you can edit them, add
`{{ .Token }}` to the Magic Link template, and the app's "code from the email" field
starts working as an alternative to tapping the link.

## Add Google sign-in

Google sign-in is the recommended option, because it takes one tap, needs no inbox
round-trip, and avoids email rate limits.

### In the Google Cloud console

1. At [console.cloud.google.com](https://console.cloud.google.com), open the project
   picker and click **New project**. Name it `jabkozdarma`.
2. Go to **APIs & Services > OAuth consent screen**, choose the **External** user type,
   and enter `JabkoZdarma` as the app name and your email as both the support and
   developer contact. Click **Save**. Leave the scopes empty, because email and profile
   are included by default.

   While the consent screen stays in **Testing**, only accounts listed under **Test
   users** can sign in. Click **Publish app** when you want to open it to everyone.
   Basic email and profile scopes don't need Google's verification review.
3. Go to **APIs & Services > Credentials > Create credentials > OAuth client ID** and
   choose the **Web application** type. Then set:
   - **Authorized JavaScript origins**: `https://n041m.github.io` and
     `http://localhost:8081`
   - **Authorized redirect URI**: `https://lpipnyievajqvapcpcoy.supabase.co/auth/v1/callback`

   **Caution:** The redirect URI is Supabase's callback, not the app URL. Getting this
   wrong is the most common failure.
4. Copy the **Client ID** and **Client secret**.

### In Supabase

Go to **Authentication > Sign In / Providers > Google**, turn the provider on, paste
the client ID and secret, and click **Save**. The app's "Continue with Google" button
starts working right away, with no redeploy.

## Optional: add custom SMTP with Brevo

You don't need this to run the app. Auth stays on Supabase: Google for most people, and
Supabase's built-in mailer as the magic-link fallback. That mailer sends only a couple
of emails an hour, which is enough while Google carries the load.

Set up Brevo only when email sign-in gets real use. Brevo's free tier sends about 300
emails a day and works without a domain of your own, because it verifies a single
sender address instead.

1. Create a free account at [brevo.com](https://www.brevo.com).
2. Go to **Senders, Domains & Dedicated IPs > Senders > Add a sender**, and enter your
   name and the address you want the app to send from. Brevo emails you a confirmation
   link. Click it, or Brevo sends nothing.
3. Go to **SMTP & API > SMTP**. Note the server, `smtp-relay.brevo.com`, the port,
   `587`, and your **SMTP login**. Then click **Generate a new SMTP key** and copy the
   key.
4. In Supabase, go to **Authentication > Emails > SMTP Settings** and turn on custom
   SMTP with these values:
   - **Sender email**: the address you verified in step 2
   - **Sender name**: `JabkoZdarma`
   - **Host**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Username**: your Brevo SMTP login
   - **Password**: the SMTP key
5. Go to **Authentication > Rate Limits** and raise **Emails per hour**. 100 is plenty.

Custom SMTP has two consequences. Email templates become editable, so you can add
`{{ .Token }}` to the Magic Link template if you want code-based login back. And
deliverability now depends on your sender address: a free webmail sender can't be
DKIM-signed, so some mail lands in spam. For launch, register a domain and verify that
instead.

## Copy the two values

Go to **Project Settings > API** and copy:

- The **Project URL**, which looks like `https://abcdefgh.supabase.co`
- The **anon public** API key. Newer dashboards might label this **publishable** and
  prefix it with `sb_publishable_`. Either one works.

The anon key is safe to expose in the client, because row-level security guards every
table.

## Wire up the app

For local development, copy the example environment file and paste the two values into
it:

```bash
cp .env.example .env
```

Then restart the dev server. Expo bakes environment variables in at bundle time, so a
running server doesn't pick them up.

For production on GitHub Pages, set the variables and redeploy:

```bash
gh variable set EXPO_PUBLIC_SUPABASE_URL --repo N041M/jabkozdarma
gh variable set EXPO_PUBLIC_SUPABASE_ANON_KEY --repo N041M/jabkozdarma
gh workflow run deploy.yml --repo N041M/jabkozdarma
```

## Sign in and seed the map

A fresh database is empty. The Prague demo pins exist only in local mode.

1. Open the app, go to **Profil**, choose a username, enter your email, and click
   **Poslat přihlašovací odkaz**. Open the email on the same device and browser as the
   app, and then click the sign-in link.
2. To verify, check that **Authentication > Users** lists your account and that
   **Table Editor > profiles** has your row.
3. Optional: to start the map with the five Prague pins, run [`seed.sql`](seed.sql) in
   the SQL Editor after that first sign-in. The script attaches the pins to the first
   profile in the database.

## Migrations for an existing database

Run each of these once in the SQL Editor. All of them are safe to run again:

- [`migration-001-fixes.sql`](migration-001-fixes.sql) fixes the viewport RPC and adds
  the policy that lets people delete their own pins.
- [`migration-002-gdpr.sql`](migration-002-gdpr.sql) adds `delete_my_account()`, which
  the app's "Smazat účet" button calls. Without it, that button fails.
- [`migration-003-verification.sql`](migration-003-verification.sql) adds the write
  limits and the confirmation model described below. Every project needs this one, not
  only an existing database. Until you run it, the app still works, but new pins go live
  unchecked and the tree detail screen can't confirm anything.
- [`migration-004-placement.sql`](migration-004-placement.sql) adds `placed_distance_m`,
  the evidence a pin carries about how far its author stood from it, and the 150 m leash
  that goes with it. It also stops `accuracy_m` refusing pins, because the app now aims
  a pin against the map instead of dropping it on the device's fix. Every project needs
  this one too, and until you run it, adding a tree fails: the app writes a column the
  database doesn't have.

## Verification

Anyone can sign up and the anon key ships in the app bundle, so nothing the client
checks stops a script from posting pins straight to PostgREST. Migration 003 moves the
rules into the database, where they hold:

- **Limits on writing.** One account gets 12 pins a day, none of them within 15 m of
  another of its own, and none outside a bounding box around Czechia. A pin placed from
  a fix vaguer than 100 m is refused.
- **Corroboration for showing.** Every pin starts `unverified`: the map draws it faded
  and Sklizeň leaves it out. Two other pickers standing within 60 m of it promote it to
  `active`. Nobody can confirm their own pin, and `confirm_tree()` measures the distance
  against the stored location, so a caller can't assert it.
- **Corroboration for removing, too.** A "tree is gone" flag used to hide a pin on one
  tap. It now takes two pickers, unless the pin's own author says so.

The thresholds are mirrored in [`src/lib/verification.ts`](../src/lib/verification.ts),
which enforces them in local mode and writes the messages the app shows. **Change one
copy and change the other**, or local mode starts promising what the database refuses.

To vouch for a pin by hand — a tree you know is real, or one a new district needs to get
started — set its `trusted` column:

```sql
select set_tree_trusted('…');
```

Use that function rather than updating the column directly. A plain
`update trees set trusted = true` is reverted by the guard that stops contributors from
promoting their own pins, and it reports `UPDATE 1` while changing nothing.
`set_tree_trusted()` sets the column and recomputes the status in one step. Pass `false`
as a second argument to withdraw the vouch.

Migration 003 sets `trusted` on everything that already existed, so running it never
blanks a live map.

## GDPR checklist

The app ships a privacy notice at **Profil > Soukromí a vaše data**, along with data
export and account deletion. Two things need your confirmation:

1. **Host the project in the EU.** Check **Project Settings > General**. The privacy
   notice states that the data is hosted in the EU. If your project is elsewhere,
   either move it, which is easiest while the data is small, or correct the text in
   [`src/lib/privacy-text.ts`](../src/lib/privacy-text.ts).
2. **Add a contact address.** The notice's contact section currently tells people to
   contact the operator without giving an address, and GDPR expects a real one. Edit
   the last section of [`src/lib/privacy-text.ts`](../src/lib/privacy-text.ts).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The link in the email says "requested path is invalid" | The app URL isn't in **Redirect URLs**. Add it. |
| Tapping the link doesn't sign you in | You opened the link in a different browser from the app. Open the email on the same device and browser. |
| "email rate limit exceeded" | You hit the built-in mailer's cap of a couple of emails an hour. Wait, or set up Brevo. |
| The Google button returns `redirect_uri_mismatch` | The Cloud console redirect URI must be the Supabase `/auth/v1/callback` URL, not the app URL. |
| Google sign-in says the app is blocked | The OAuth consent screen is still in **Testing**. Add the account under **Test users**, or publish the app. |
| Brevo mail never arrives | You didn't confirm the sender address, or the mail landed in spam. |
| The app still says "Local mode" | The environment variables aren't baked in. Restart the dev server, or redeploy after you set the variables. |
| The map is empty after you connect the backend | This is expected on a fresh database. Sign in and add a tree, or run `seed.sql`. |
| The schema run fails midway | The project wasn't fresh, or you ran the script twice. Don't run it again. Write a targeted cleanup script. |
| Migration 003 says `type "extensions.geography" does not exist` | Your project keeps PostGIS in a different schema. Check with `select nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname = 'postgis'`, and add that schema to the `set search_path` line of any function that fails. |
| Adding a tree fails with `Could not find the 'placed_distance_m' column` | You haven't run [`migration-004-placement.sql`](migration-004-placement.sql) yet. Run it, then reload the app. |
| Migration 003 says `cannot change return type of existing function` | An older `trees_in_bbox` is still there and Postgres won't replace it with one that returns more columns. The migration drops it first, so this means you're running an outdated copy of the file. |
