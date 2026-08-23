-- Migration 002 — GDPR: let a signed-in person erase their own account.
-- Run once in the SQL Editor. Safe to re-run.
--
-- The client can't touch auth.users, so this runs as a definer function that
-- only ever acts on the caller's own id. It removes their contributions too
-- (trees they added, and the reports/photos/flags/favourites attached to
-- them), which is what the app promises in the privacy notice.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from favorites where user_id = uid;
  delete from flags where user_id = uid;
  delete from reports where user_id = uid;
  delete from tree_photos where user_id = uid;
  -- deleting the trees cascades their photos/reports/flags/favourites
  delete from trees where created_by = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
