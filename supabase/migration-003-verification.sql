-- Migration 003 — verification: limits on what one account can write, and
-- corroboration to decide what the map shows. Run once in the SQL Editor.
-- Safe to re-run.
--
-- The thresholds here must match `src/lib/verification.ts`, which is the
-- copy the app enforces in local mode and previews in the UI. This is the
-- copy that counts: everything the client checks is advice a script skips,
-- because the anon key ships in the bundle and PostgREST is one POST away.
--
-- What changes:
--   1. Pins start `unverified`, and no client can declare its own otherwise.
--   2. `tree_confirmations` records one picker vouching for one tree from
--      within 60 m of it. The distance is measured here, against the stored
--      location, so a caller can't assert it.
--   3. Insert triggers cap pins per account per day, refuse pins stacked on
--      that account's own pins, and refuse anything outside the service area.
--   4. Owners keep editing their pins, but can't move a confirmed one and
--      can't set its status.
--   5. "It's gone" needs corroboration too, unless the author says it.

-- ---------- a ledger, so the backfill at the end runs exactly once ----------
create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;
-- no policies: this is operator bookkeeping, not app data. The API can't
-- read it, and the definer blocks below don't go through the API.

-- ---------- evidence carried by a pin ----------
alter table trees add column if not exists accuracy_m smallint;
alter table trees add column if not exists confirmations smallint not null default 0;
alter table trees add column if not exists trusted boolean not null default false;
alter table trees alter column status set default 'unverified';

comment on column trees.accuracy_m is
  'Radius of the fix this pin was placed from, in metres. Evidence, not proof.';
comment on column trees.confirmations is
  'Distinct confirming pickers, author excluded. Maintained by trigger only.';
comment on column trees.trusted is
  'Active without corroboration: pins that predate these rules, and anything the operator vouches for by hand. Grants trust only — a gone flag still retires the tree.';

-- ---------- confirmations ----------
create table if not exists tree_confirmations (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  distance_m real not null,
  accuracy_m smallint,
  created_at timestamptz not null default now(),
  unique (tree_id, user_id)
);

create index if not exists tree_confirmations_tree_idx
  on tree_confirmations (tree_id);
create index if not exists tree_confirmations_user_idx
  on tree_confirmations (user_id, created_at desc);

alter table tree_confirmations enable row level security;

-- Counts are public, because "two other people have stood here" is the
-- whole point. Writes go through confirm_tree() and nowhere else, so
-- distance_m is always something this database measured.
drop policy if exists "confirmations are public" on tree_confirmations;
create policy "confirmations are public" on tree_confirmations for select using (true);

drop policy if exists "users delete own confirmations" on tree_confirmations;
create policy "users delete own confirmations" on tree_confirmations
  for delete using (auth.uid() = user_id);

-- ---------- the promotion rule ----------
-- Definer, because it writes a status no caller is allowed to write.
create or replace function recompute_tree_status(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
  is_trusted boolean;
  votes integer;
  gone_votes integer;
  author_says_gone boolean;
begin
  select created_by, trusted into author, is_trusted from trees where id = target;
  if author is null then
    return; -- deleted between the write and this call
  end if;

  select count(distinct user_id) into votes
  from tree_confirmations
  where tree_id = target and user_id <> author;

  select count(distinct user_id), coalesce(bool_or(user_id = author), false)
  into gone_votes, author_says_gone
  from flags
  where tree_id = target and reason = 'gone' and not resolved;

  -- The update guard below pins `status` and `confirmations` against client
  -- writes, and a SECURITY DEFINER function is not exempt from triggers. This
  -- flag is how the system's own promotion gets through; it is transaction
  -- local and cleared immediately after, so it can never wave a client write
  -- through later in the same transaction.
  perform set_config('app.internal_write', 'on', true);

  update trees
  set
    confirmations = votes,
    status = case
      -- A tree somebody cut down is not a tree, however well confirmed it
      -- once was. Its author retiring it is decisive; anyone else needs a
      -- second picker to agree, so one grudge can't erase a real tree.
      when author_says_gone or gone_votes >= 2 then 'gone'
      -- `trusted` is the grandfather clause and the operator's override.
      -- Without it, recomputing a long-standing pin would demote it for
      -- never having been voted on.
      when is_trusted or votes >= 2 then 'active'
      else 'unverified'
    end::tree_status
  where id = target;

  perform set_config('app.internal_write', 'off', true);
end $$;

revoke all on function recompute_tree_status(uuid) from public, anon, authenticated;

create or replace function on_confirmation_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recompute_tree_status(case tg_op when 'DELETE' then old.tree_id else new.tree_id end);
  return null;
end $$;

drop trigger if exists tree_confirmations_recompute on tree_confirmations;
create trigger tree_confirmations_recompute
  after insert or delete on tree_confirmations
  for each row execute function on_confirmation_change();

create or replace function on_flag_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  why flag_reason;
begin
  -- NEW is unassigned on DELETE and OLD on INSERT; reading the wrong one
  -- raises rather than returning null.
  if tg_op = 'DELETE' then
    target := old.tree_id;
    why := old.reason;
  else
    target := new.tree_id;
    why := new.reason;
  end if;
  if why = 'gone' then
    perform recompute_tree_status(target);
  end if;
  return null;
end $$;

drop trigger if exists flags_recompute on flags;
create trigger flags_recompute
  after insert or update or delete on flags
  for each row execute function on_flag_change();

-- ---------- write limits on pins ----------
-- These are the rules a script runs into. Someone walking a district hits
-- none of them; a loop over the REST endpoint hits all of them at once.
create or replace function check_new_tree()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  lat double precision := st_y(new.location::geometry);
  lng double precision := st_x(new.location::geometry);
  today_count integer;
  stacked integer;
begin
  -- No client gets to declare its own pin trustworthy.
  new.status := 'unverified';
  new.confirmations := 0;
  new.trusted := false;

  if new.accuracy_m is not null and new.accuracy_m > 100 then
    raise exception 'bad_fix' using errcode = 'check_violation';
  end if;

  -- The service area, generously: the Czech Republic. Wide enough to grow
  -- to Brno without a migration, tight enough to refuse the Pacific. NaN
  -- lands here too — Postgres sorts it above every real number.
  if lat < 48.5 or lat > 51.1 or lng < 12.0 or lng > 18.9 then
    raise exception 'out_of_area' using errcode = 'check_violation';
  end if;

  -- `status <> 'gone'` matches what the client can count: trees_in_bbox never
  -- returns retired pins, so without this the app would believe a write is
  -- legal and the database would refuse it. It also means a picker whose pin
  -- was retired because the tree really was cut down isn't charged for it.
  select count(*) into today_count
  from trees
  where created_by = new.created_by
    and status <> 'gone'
    and created_at >= date_trunc('day', now() at time zone 'Europe/Prague');
  if today_count >= 12 then
    raise exception 'daily_limit' using errcode = 'check_violation';
  end if;

  select count(*) into stacked
  from trees
  where created_by = new.created_by
    and status <> 'gone'
    and st_dwithin(location, new.location, 15);
  if stacked > 0 then
    raise exception 'too_close' using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trees_check_insert on trees;
create trigger trees_check_insert
  before insert on trees
  for each row execute function check_new_tree();

-- ---------- what an owner may still change ----------
-- Editing the variety or the notes on your own pin: yes. Promoting it, or
-- walking a confirmed pin across town after other people vouched for the
-- spot they actually saw: no.
create or replace function check_tree_update()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- recompute_tree_status() and set_tree_trusted() raise this flag around
  -- their own writes. Everything else is a client, and a client never gets
  -- to promote its own pin.
  if coalesce(current_setting('app.internal_write', true), 'off') = 'on' then
    return new;
  end if;

  new.status := old.status;
  new.confirmations := old.confirmations;
  new.trusted := old.trusted;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if not st_equals(new.location::geometry, old.location::geometry) then
    if old.confirmations > 0 then
      raise exception 'confirmed_pin_is_fixed' using errcode = 'check_violation';
    end if;
    if st_distance(new.location, old.location) > 15 then
      raise exception 'moved_too_far' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trees_check_update on trees;
create trigger trees_check_update
  before update on trees
  for each row execute function check_tree_update();

-- ---------- confirming, as an RPC ----------
-- The caller says where they are; this measures how far that is from the
-- tree. Someone who lies about their position still has to know where the
-- tree is and hold a second account for every confirmation — which is the
-- point at which contributor trust scoring, not geometry, is the answer.
create or replace function confirm_tree(
  target uuid,
  lat double precision,
  lng double precision,
  accuracy smallint default null
)
returns tree_status
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  tree trees;
  gap double precision;
  today_count integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  -- Postgres considers NaN equal to itself, so `lat <> lat` won't catch it.
  if lat is null or lng is null
     or lat = 'NaN'::double precision or lng = 'NaN'::double precision then
    raise exception 'no_fix' using errcode = 'check_violation';
  end if;
  if accuracy is not null and accuracy > 100 then
    raise exception 'bad_fix' using errcode = 'check_violation';
  end if;

  select * into tree from trees where id = target;
  if not found then
    raise exception 'no_such_tree' using errcode = 'no_data_found';
  end if;
  if tree.created_by = uid then
    raise exception 'own_tree' using errcode = 'check_violation';
  end if;

  select count(*) into today_count
  from tree_confirmations
  where user_id = uid
    and created_at >= date_trunc('day', now() at time zone 'Europe/Prague');
  if today_count >= 30 then
    raise exception 'daily_limit' using errcode = 'check_violation';
  end if;

  -- Nothing here names the schema PostGIS lives in. A plpgsql *declaration*
  -- resolves its type when the function is created, using whatever
  -- search_path the session happens to have, so `here extensions.geography`
  -- failed on projects where PostGIS sits in `public` instead. An expression
  -- resolves when the function runs, under the search_path set above, which
  -- finds the type either way.
  gap := st_distance(tree.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography);
  if gap > 60 then
    raise exception 'too_far' using errcode = 'check_violation';
  end if;

  insert into tree_confirmations (tree_id, user_id, distance_m, accuracy_m)
  values (target, uid, gap, accuracy)
  on conflict (tree_id, user_id) do nothing;

  -- A conflict means this picker already vouched for this tree. Saying so is
  -- what stops the caller from crediting the reward a second time; silently
  -- returning the status made a no-op look like a fresh confirmation.
  if not found then
    raise exception 'already_confirmed' using errcode = 'unique_violation';
  end if;

  -- The trigger has already recomputed it by now.
  return (select status from trees where id = target);
end $$;

revoke all on function confirm_tree(uuid, double precision, double precision, smallint)
  from public, anon;
grant execute on function confirm_tree(uuid, double precision, double precision, smallint)
  to authenticated;

-- ---------- vouching by hand ----------
-- A plain `update trees set trusted = true` is silently reverted by the guard
-- above, which reports UPDATE 1 while changing nothing. This is the supported
-- way to vouch for a pin: it raises the internal-write flag, sets the column,
-- and recomputes the status so the change shows up on the map at once.
--
-- Not granted to anon or authenticated: it is the operator's tool, run from
-- the SQL editor.
create or replace function set_tree_trusted(target uuid, value boolean default true)
returns tree_status
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal_write', 'on', true);
  update trees set trusted = value where id = target;
  -- Read FOUND before anything else runs: PERFORM is a statement too, and
  -- would overwrite it.
  if not found then
    perform set_config('app.internal_write', 'off', true);
    raise exception 'no_such_tree' using errcode = 'no_data_found';
  end if;
  perform set_config('app.internal_write', 'off', true);

  perform recompute_tree_status(target);
  return (select status from trees where id = target);
end $$;

revoke all on function set_tree_trusted(uuid, boolean) from public, anon, authenticated;

-- ---------- the viewport query carries the evidence ----------
-- Dropped rather than replaced: this adds three output columns, and Postgres
-- refuses to change the row type an existing function's OUT parameters
-- define. Nothing depends on it but the app's RPC call, so the gap between
-- the drop and the create is the length of this transaction.
drop function if exists trees_in_bbox(
  double precision, double precision, double precision, double precision
);

create or replace function trees_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  id uuid,
  lat double precision,
  lng double precision,
  species text,
  variety text,
  description text,
  access access_type,
  status tree_status,
  season_start smallint,
  season_end smallint,
  created_by uuid,
  created_at timestamptz,
  accuracy_m smallint,
  confirmations smallint,
  trusted boolean,
  latest_state ripeness_state,
  latest_report_at timestamptz
)
language sql stable
set search_path = public, extensions
as $$
  select
    t.id,
    st_y(t.location::geometry) as lat,
    st_x(t.location::geometry) as lng,
    t.species, t.variety, t.description, t.access, t.status,
    t.season_start, t.season_end, t.created_by, t.created_at,
    t.accuracy_m, t.confirmations, t.trusted,
    r.state as latest_state,
    r.created_at as latest_report_at
  from trees t
  left join lateral (
    select state, created_at
    from reports
    where tree_id = t.id
    order by created_at desc
    limit 1
  ) r on true
  where t.status <> 'gone'
    and t.location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  limit 2000;
$$;

-- ---------- erasure covers the new table ----------
create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  touched uuid[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Remember which pins this person vouched for: withdrawing the vouch has
  -- to demote them again, not leave them standing on a deleted vote.
  select array_agg(distinct tree_id) into touched
  from tree_confirmations where user_id = uid;

  delete from favorites where user_id = uid;
  delete from flags where user_id = uid;
  delete from reports where user_id = uid;
  delete from tree_photos where user_id = uid;
  delete from tree_confirmations where user_id = uid;
  -- deleting the trees cascades their photos/reports/flags/confirmations
  delete from trees where created_by = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;

  if touched is not null then
    perform recompute_tree_status(t) from unnest(touched) as t;
  end if;
end $$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- ---------- backfill, once ----------
-- Pins written before this migration were written when everything was
-- trusted. Grandfather them in as `active` rather than blanking a live map,
-- and let the rules govern everything from here. Guarded by the ledger, so
-- re-running the file never promotes pins that are legitimately waiting for
-- their confirmations, and stepped past the update trigger, which otherwise
-- pins `status` to whatever it already was.
do $$
begin
  if not exists (select 1 from schema_migrations where name = '003-verification') then
    alter table trees disable trigger trees_check_update;
    update trees set trusted = true, status = 'active' where status <> 'gone';
    alter table trees enable trigger trees_check_update;
    insert into schema_migrations (name) values ('003-verification');
  end if;
end $$;
