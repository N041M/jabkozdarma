-- JabkoZdarma — Supabase schema (Postgres + PostGIS)
-- Run in the Supabase SQL editor of a fresh project, then set
-- EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.

create extension if not exists postgis;

-- ---------- enums ----------
create type access_type as enum ('public', 'roadside', 'ask_owner');
create type tree_status as enum ('active', 'gone', 'unverified');
create type ripeness_state as enum ('flowering', 'unripe', 'ripe', 'past', 'bare');
create type flag_reason as enum ('gone', 'duplicate', 'private', 'wrong_info');

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 2 and 30),
  bio text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Tolerant: on username collision the app's ensureProfile() picks a free one.
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'picker-' || left(new.id::text, 8)))
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- trees ----------
create table trees (
  id uuid primary key default gen_random_uuid(),
  location geography(point, 4326) not null,
  species text not null default 'apple',
  variety text,
  description text,
  access access_type not null,
  status tree_status not null default 'active',
  season_start smallint check (season_start between 1 and 12),
  season_end smallint check (season_end between 1 and 12),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index trees_location_idx on trees using gist (location);

-- ---------- photos ----------
create table tree_photos (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees (id) on delete cascade,
  user_id uuid not null references profiles (id),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- ripeness reports ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees (id) on delete cascade,
  user_id uuid not null references profiles (id),
  state ripeness_state not null,
  note text,
  created_at timestamptz not null default now()
);

create index reports_tree_idx on reports (tree_id, created_at desc);

-- ---------- moderation flags ----------
create table flags (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees (id) on delete cascade,
  user_id uuid not null references profiles (id),
  reason flag_reason not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tree_id, user_id, reason)
);

-- ---------- favorites ----------
create table favorites (
  user_id uuid not null references profiles (id) on delete cascade,
  tree_id uuid not null references trees (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tree_id)
);

-- ---------- the workhorse query: trees in viewport + freshest report ----------
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
  latest_state ripeness_state,
  latest_report_at timestamptz
)
language sql stable as $$
  select
    t.id,
    st_y(t.location::geometry) as lat,
    st_x(t.location::geometry) as lng,
    t.species, t.variety, t.description, t.access, t.status,
    t.season_start, t.season_end, t.created_by, t.created_at,
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
    and t.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  limit 2000;
$$;

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table trees enable row level security;
alter table tree_photos enable row level security;
alter table reports enable row level security;
alter table flags enable row level security;
alter table favorites enable row level security;

-- everyone (anon included) can read the map
create policy "profiles are public" on profiles for select using (true);
create policy "trees are public" on trees for select using (true);
create policy "photos are public" on tree_photos for select using (true);
create policy "reports are public" on reports for select using (true);

-- contributors write their own rows
create policy "users insert own trees" on trees
  for insert with check (auth.uid() = created_by);
create policy "users update own trees" on trees
  for update using (auth.uid() = created_by);

create policy "users insert own photos" on tree_photos
  for insert with check (auth.uid() = user_id);
create policy "users delete own photos" on tree_photos
  for delete using (auth.uid() = user_id);

create policy "users insert own reports" on reports
  for insert with check (auth.uid() = user_id);

create policy "users insert own flags" on flags
  for insert with check (auth.uid() = user_id);
create policy "users read own flags" on flags
  for select using (auth.uid() = user_id);

create policy "users manage own favorites" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users update own profile" on profiles
  for update using (auth.uid() = id);
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- ---------- storage ----------
insert into storage.buckets (id, name, public)
values ('tree-photos', 'tree-photos', true)
on conflict (id) do nothing;

create policy "anyone reads tree photos" on storage.objects
  for select using (bucket_id = 'tree-photos');
create policy "users upload tree photos" on storage.objects
  for insert with check (bucket_id = 'tree-photos' and auth.uid() is not null);
