-- =====================================================================
--  KONEKT — "מה הקטע שלך כרגע?": a short live status (max 60 chars) that
--  shows on nearby cards, in room member lists and next to a person you
--  are about to message. It disappears 8 hours after it was last set.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: supabase_schema.sql, migrations/campus_tags.sql (get_nearby_users with tags),
--            migrations/private_groups.sql + rooms_invites.sql (get_group_members).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists current_intent text
  check (current_intent is null or char_length(current_intent) <= 60);
alter table public.profiles add column if not exists current_intent_at timestamptz;

-- The timestamp is kept by the database, never by the phone: set whenever the text changes, cleared when it is emptied.
create or replace function private.touch_current_intent()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.current_intent := nullif(btrim(new.current_intent), '');
    new.current_intent_at := case when new.current_intent is null then null else now() end;
  elsif new.current_intent is distinct from old.current_intent then
    new.current_intent := nullif(btrim(new.current_intent), '');
    new.current_intent_at := case when new.current_intent is null then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_touch_current_intent on public.profiles;
create trigger profiles_touch_current_intent
  before insert or update of current_intent on public.profiles
  for each row execute function private.touch_current_intent();

-- ---------------------------------------------------------------------
-- 2. Functions that hand a person's public card to someone else now include the intent
--    (only while it is fresh: set within the last 8 hours).
-- ---------------------------------------------------------------------
drop function if exists public.get_nearby_users(double precision, double precision, double precision);
drop function if exists public.get_group_members(uuid);
drop function if exists public.get_public_profiles(uuid[]);

-- get_nearby_users — same rules as before (visible, ≤75 m, anti-probing, never returns link URLs) + current_intent.
create function public.get_nearby_users(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision default 75
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
  distance_m     int
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
           case when p.current_intent_at > now() - interval '8 hours' then p.current_intent end,
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

-- get_group_members — name, photo, headline and (fresh) intent of EVERY member; links only where shared in the room.
create function public.get_group_members(grp uuid)
returns table (
  member_id        uuid,
  first_name       text,
  headline         text,
  avatar_url       text,
  current_intent   text,
  share_socials    boolean,
  share_instagram  boolean,
  linkedin_url     text,
  instagram_handle text
)
language sql stable security definer set search_path = public
as $$
  select gm.user_id, p.first_name, p.headline, p.avatar_url,
         case when p.current_intent_at > now() - interval '8 hours' then p.current_intent end,
         gm.share_socials, gm.share_instagram,
         case when gm.share_socials   then p.linkedin_url end,
         case when gm.share_instagram then p.instagram_handle end
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = grp
    and private.is_group_member(grp, auth.uid())
    and not private.is_blocked(auth.uid(), gm.user_id)
  order by gm.joined_at, p.first_name;
$$;

-- get_public_profiles — the partner's card for chats and requests (unchanged rules) + current_intent.
create function public.get_public_profiles(ids uuid[])
returns table (id uuid, first_name text, headline text, avatar_url text, current_intent text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.first_name, p.headline, p.avatar_url,
         case when p.current_intent_at > now() - interval '8 hours' then p.current_intent end
  from public.profiles p
  where p.id = any(ids)
    and (
      exists (select 1 from public.connection_requests r
              where r.sender_id = auth.uid() and r.receiver_id = p.id
                and r.status = 'pending' and r.expires_at > now())
      or not private.is_blocked(auth.uid(), p.id)
    )
    and (
      exists (select 1 from public.chats c
              where c.expires_at > now()
                and c.user_a = least(auth.uid(), p.id) and c.user_b = greatest(auth.uid(), p.id))
      or exists (select 1 from public.connection_requests r
                 where (r.sender_id = auth.uid() and r.receiver_id = p.id)
                    or (r.receiver_id = auth.uid() and r.sender_id = p.id))
    );
$$;

revoke all on function public.get_nearby_users(double precision, double precision, double precision) from public, anon;
revoke all on function public.get_group_members(uuid)  from public, anon;
revoke all on function public.get_public_profiles(uuid[]) from public, anon;
grant execute on function public.get_nearby_users(double precision, double precision, double precision) to authenticated;
grant execute on function public.get_group_members(uuid)  to authenticated;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;

notify pgrst, 'reload schema';
