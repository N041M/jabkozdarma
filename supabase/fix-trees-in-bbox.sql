-- Fix: trees_in_bbox failed on very wide viewports ("Antipodal edge detected")
-- because geography envelopes can't span 180°+ of longitude. Compare in
-- geometry space instead (and index it). Safe to run on a live database.

create index if not exists trees_location_geom_idx
  on trees using gist ((location::geometry));

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
    and t.location::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  limit 2000;
$$;
