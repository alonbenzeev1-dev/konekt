-- =====================================================================
--  KONEKT — Quick campus tags (up to 3 per profile), shown on nearby cards
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires the main schema (supabase_schema.sql) to be applied first.
-- =====================================================================

alter table public.profiles add column if not exists tags text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_tags_check;
alter table public.profiles add constraint profiles_tags_check
  check (cardinality(tags) <= 3 and octet_length(array_to_string(tags, '|')) <= 160);

-- get_nearby_users now also returns each person's tags (same rules as before:
-- visible, ≤75 m, anti-probing, never returns linkedin_url / instagram_handle).
drop function if exists public.get_nearby_users(double precision, double precision, double precision);

create function public.get_nearby_users(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision default 75
)
returns table (
  id            uuid,
  first_name    text,
  headline      text,
  avatar_url    text,
  tags          text[],
  has_linkedin  boolean,
  has_instagram boolean,
  distance_m    int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  me   public.profiles;
  r    double precision := least(coalesce(radius_meters, 75), 75);
  dlat double precision;
  dlng double precision;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if me.id is null or not me.is_visible or me.lat is null
     or me.last_seen_at < now() - interval '5 minutes'
     or public.konekt_distance(me.lat, me.lng, user_lat, user_lng) > 150 then
    return;
  end if;

  dlat := r / 111320.0;
  dlng := r / (111320.0 * greatest(cos(radians(user_lat)), 0.01));

  return query
  select * from (
    select p.id, p.first_name, p.headline, p.avatar_url, p.tags,
           (p.linkedin_url is not null), (p.instagram_handle is not null),
           (round(public.konekt_distance(user_lat, user_lng, p.lat, p.lng) / 5) * 5)::int as d
    from public.profiles p
    where p.is_visible
      and p.id <> me.id
      and p.lat is not null
      and p.last_seen_at > now() - interval '10 minutes'
      and p.lat between user_lat - dlat and user_lat + dlat
      and p.lng between user_lng - dlng and user_lng + dlng
      and not private.is_blocked(me.id, p.id)
  ) s
  where s.d <= r
  order by s.d
  limit 100;
end;
$$;

revoke all on function public.get_nearby_users(double precision, double precision, double precision) from public, anon;
grant execute on function public.get_nearby_users(double precision, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
