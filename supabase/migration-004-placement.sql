-- Migration 004 — placement: a pin is aimed, not dropped. Run once in the
-- SQL Editor. Safe to re-run.
--
-- The thresholds here must match `src/lib/verification.ts`, the same way
-- migration 003's do.
--
-- Until now a pin's coordinate *was* the device's fix, which welded three
-- separate things into one number: where the tree is, where the picker was,
-- and whether they were allowed to contribute at all. The app now aims the
-- pin against the map under a crosshair, so those come apart:
--
--   1. `placed_distance_m` records how far the author stood from the pin they
--      aimed. Evidence about the author; the coordinate is the tree.
--   2. A pin may not land further than 150 m from its author's own fix.
--   3. `accuracy_m` stops refusing pins. It never described the pin — it
--      describes the author's phone — and a hand-aimed pin does not get worse
--      because the sky was blocked. It still refuses a *confirmation*, where
--      the fix is the whole of the evidence; `confirm_tree()` is untouched.
--   4. A pin's evidence is fixed at the moment it was placed, so an owner
--      editing their own pin can no longer rewrite it.
--
-- On what 2. is and isn't: `confirm_tree()` can measure a claimed position
-- against a location the caller does not control, which is why that distance
-- means something. Somebody placing a pin chooses *both* points, so nothing
-- this function can compute makes the number harder to lie about. It is here
-- to catch a mis-aimed pin from an honest client and to keep this file and
-- `verification.ts` saying the same thing. Corroboration is what answers a
-- dishonest one, and it is unchanged: two other pickers, each standing there.

-- ---------- evidence carried by a pin ----------
alter table trees add column if not exists placed_distance_m real;

comment on column trees.placed_distance_m is
  'How far the author stood from the pin when they aimed it, in metres. Null when they had no usable fix, which is not a refusal. The distance and not the position: it answers the only question the map has about where the author was standing.';

comment on column trees.accuracy_m is
  'Radius of the fix its author had when they placed it, in metres. Evidence about the author, not about the pin — the pin is aimed by hand.';

-- ---------- write limits on pins ----------
-- Unchanged from migration 003 except where marked. Restated in full rather
-- than patched, because a trigger function half-described in two files is a
-- rule nobody can read.
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

  -- 004: the `accuracy_m > 100` refusal that stood here is gone. The column
  -- stays, and stays evidence; it simply no longer decides whether a pin
  -- somebody aimed by eye is allowed to exist.

  -- The service area, generously: the Czech Republic. Wide enough to grow
  -- to Brno without a migration, tight enough to refuse the Pacific. NaN
  -- lands here too — Postgres sorts it above every real number.
  if lat < 48.5 or lat > 51.1 or lng < 12.0 or lng > 18.9 then
    raise exception 'out_of_area' using errcode = 'check_violation';
  end if;

  -- 004: the leash. A pin belongs to a walk, so it lands within sight of the
  -- person placing it. Null means they had no fix worth the name, which is
  -- allowed and carries no claim of having been there.
  if new.placed_distance_m is not null and new.placed_distance_m > 150 then
    raise exception 'placed_too_far' using errcode = 'check_violation';
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
-- As migration 003 left it, plus the evidence columns. Editing the variety or
-- the notes on your own pin: yes. Rewriting how close you were standing when
-- you placed it, months later, once it matters: no. Evidence describes a
-- moment, and that moment is over.
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
  new.accuracy_m := old.accuracy_m;
  new.placed_distance_m := old.placed_distance_m;

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

-- ---------- the viewport query carries the new column ----------
-- Dropped rather than replaced, for the same reason migration 003 dropped it:
-- this adds an output column, and Postgres refuses to change the row type an
-- existing function's OUT parameters define.
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
  placed_distance_m real,
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
    t.accuracy_m, t.placed_distance_m, t.confirmations, t.trusted,
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

-- No backfill. Pins written before this migration were dropped on their
-- author's own fix, so the honest distance is the one nobody measured, and
-- null is what says that. Inventing a zero would claim every one of them was
-- placed from directly underneath the tree.
insert into schema_migrations (name) values ('004-placement')
  on conflict (name) do nothing;
