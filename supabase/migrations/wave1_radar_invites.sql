-- =====================================================================
--  KONEKT — Wave 1: campus radar (400 m, 45 min), stale-location cleanup,
--  and room invite reset / lock.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: supabase_schema.sql, current_intent.sql, rooms_invites.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. get_nearby_users — 400 m, active in the last 45 minutes.
--    Indoor GPS drifts 150-350 m inside a building, so the main list now covers the campus.
--    Returns active_minutes (how long ago they were last seen) instead of letting the client guess.
--    Order: seen in the last 10 minutes first, then closest, then most recent.
-- ---------------------------------------------------------------------
drop function if exists public.get_nearby_users(double precision, double precision, double precision);
create function public.get_nearby_users(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision default 400
)
returns table (
  id             uuid,
  first_name     text,
  headline       text,
  avatar_url     text,
  tags           text[],
  current_intent text,
  has_linkedin   boolean,
  has_instagram  boolean,
  distance_m     int,
  active_minutes int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  me   public.profiles;
  r    double precision := least(coalesce(radius_meters, 400), 400);
  dlat double precision;
  dlng double precision;
begin
  -- I must be visible, with a fresh position of my own that matches what my phone reports (anti-probing)
  select * into me from public.profiles p where p.id = auth.uid();
  if me.id is null or not me.is_visible or me.lat is null
     or me.last_seen_at < now() - interval '5 minutes'
     or public.konekt_distance(me.lat, me.lng, user_lat, user_lng) > 150 then
    return;
  end if;

  dlat := r / 111320.0;
  dlng := r / (111320.0 * greatest(cos(radians(user_lat)), 0.01));

  return query
  select s.id, s.first_name, s.headline, s.avatar_url, s.tags, s.intent, s.li, s.ig, s.d, s.mins
  from (
    select p.id, p.first_name, p.headline, p.avatar_url, p.tags,
           case when p.current_intent_at > now() - interval '8 hours' then p.current_intent end as intent,
           (p.linkedin_url is not null) as li, (p.instagram_handle is not null) as ig,
           (round(public.konekt_distance(user_lat, user_lng, p.lat, p.lng) / 5) * 5)::int as d,
           greatest(floor(extract(epoch from (now() - p.last_seen_at)) / 60), 0)::int as mins
    from public.profiles p
    where p.is_visible
      and p.id <> me.id
      and p.lat is not null
      and p.last_seen_at > now() - interval '45 minutes'
      and p.lat between user_lat - dlat and user_lat + dlat
      and p.lng between user_lng - dlng and user_lng + dlng
      and not private.is_blocked(me.id, p.id)
  ) s
  where s.d <= r
  order by (s.mins > 10), s.d, s.mins
  limit 100;
end;
$$;

revoke all on function public.get_nearby_users(double precision, double precision, double precision) from public, anon;
grant execute on function public.get_nearby_users(double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- 2. get_campus_count — "a bit further": active in the last 45 minutes, between 400 m and 2 km.
--    (People inside 400 m are in the main list, so they are not counted twice.) Returns a number only.
-- ---------------------------------------------------------------------
create or replace function public.get_campus_count(user_lat double precision, user_lng double precision)
returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  me   public.profiles;
  dlat double precision := 2000 / 111320.0;
  dlng double precision;
  n    int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if me.id is null or not me.is_visible or me.lat is null
     or me.last_seen_at < now() - interval '5 minutes'
     or public.konekt_distance(me.lat, me.lng, user_lat, user_lng) > 150 then
    return 0;
  end if;
  dlng := 2000 / (111320.0 * greatest(cos(radians(user_lat)), 0.01));

  select count(*) into n
  from public.profiles p
  where p.is_visible
    and p.id <> me.id
    and p.lat is not null
    and p.last_seen_at > now() - interval '45 minutes'
    and p.lat between user_lat - dlat and user_lat + dlat
    and p.lng between user_lng - dlng and user_lng + dlng
    and public.konekt_distance(user_lat, user_lng, p.lat, p.lng) between 400 and 2000
    and not private.is_blocked(me.id, p.id);
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. konekt_cleanup — coordinates older than 45 minutes are wiped (no location history, no ghosts).
--    The RPCs above also ignore stale rows, so a missed cron run never shows anyone.
-- ---------------------------------------------------------------------
create or replace function public.konekt_cleanup()
returns void
language sql security definer set search_path = public
as $$
  update public.connection_requests set status = 'expired'
   where status = 'pending' and expires_at <= now();
  delete from public.chats where expires_at <= now();
  update public.profiles set lat = null, lng = null
   where lat is not null and last_seen_at < now() - interval '45 minutes';
  delete from public.connection_requests
   where status <> 'pending' and created_at < now() - interval '7 days';
$$;

-- ---------------------------------------------------------------------
-- 4. Room invites: the creator can lock new joins and reset the code.
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists invites_locked boolean not null default false;

drop function if exists public.reset_group_invite(uuid);
drop function if exists public.set_group_invites_locked(uuid, boolean);
drop function if exists public.preview_group_invite(text);

-- reset_group_invite — new 12-char code; every old link / QR stops working at once. Existing members stay.
create function public.reset_group_invite(grp uuid)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  c text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.groups g where g.id = grp and g.created_by = auth.uid())
     or not private.is_group_member(grp, auth.uid()) then
    raise exception 'only the room creator can do this';
  end if;
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    exit when not exists (select 1 from public.groups where invite_code = c);
  end loop;
  update public.groups set invite_code = c where id = grp;
  return c;
end;
$$;

-- set_group_invites_locked — while locked, nobody new can join through the link or QR.
create function public.set_group_invites_locked(grp uuid, locked boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.groups g where g.id = grp and g.created_by = auth.uid())
     or not private.is_group_member(grp, auth.uid()) then
    raise exception 'only the room creator can do this';
  end if;
  update public.groups set invites_locked = coalesce(locked, false) where id = grp;
end;
$$;

-- preview_group_invite — adds `locked`, so the join card can say "closed" instead of failing later.
create function public.preview_group_invite(code text)
returns table (
  name           text,
  description    text,
  location_tag   text,
  member_count   integer,
  already_member boolean,
  group_id       uuid,
  locked         boolean
)
language sql stable security definer set search_path = public
as $$
  select g.name, g.description, g.location_tag,
         (select count(*)::int from public.group_members m where m.group_id = g.id),
         private.is_group_member(g.id, auth.uid()),
         case when private.is_group_member(g.id, auth.uid()) then g.id end,
         g.invites_locked
  from public.groups g
  where auth.uid() is not null
    and g.invite_code = lower(btrim(code));
$$;

-- join_group_by_code — same as before, plus: a locked room accepts nobody new (members can still open it).
create or replace function public.join_group_by_code(code text)
returns public.groups
language plpgsql volatile security definer set search_path = public
as $$
declare
  g   public.groups;
  cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  select * into g from public.groups where invite_code = lower(btrim(code)) for update;
  if g.id is null then raise exception 'invite not found'; end if;
  if not private.is_group_member(g.id, auth.uid()) then
    if g.invites_locked then raise exception 'invites locked'; end if;
    select count(*) into cnt from public.group_members where group_id = g.id;
    if cnt >= 200 then raise exception 'too many members'; end if;
    insert into public.group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  end if;
  return g;
end;
$$;

revoke all on function public.reset_group_invite(uuid)                  from public, anon;
revoke all on function public.set_group_invites_locked(uuid, boolean)   from public, anon;
revoke all on function public.preview_group_invite(text)                from public, anon;
revoke all on function public.join_group_by_code(text)                  from public, anon;
grant execute on function public.reset_group_invite(uuid)                to authenticated;
grant execute on function public.set_group_invites_locked(uuid, boolean) to authenticated;
grant execute on function public.preview_group_invite(text)              to authenticated;
grant execute on function public.join_group_by_code(text)                to authenticated;

notify pgrst, 'reload schema';
