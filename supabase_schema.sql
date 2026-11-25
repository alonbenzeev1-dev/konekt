-- =====================================================================
--  KONEKT — MVP schema v2 — "פשוט תתחברו."
--  Paste this whole file into: Supabase Dashboard → SQL Editor → Run.
--
--  Works on BOTH a fresh project and a project that ran the v1 (Alpha)
--  schema. Upgrading from v1 keeps profiles but DELETES v1 chat messages
--  (they have no approved chat behind them). Safe to re-run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Drop functions (return types changed since v1; recreated below)
-- ---------------------------------------------------------------------
drop function if exists public.get_nearby_users(double precision, double precision, double precision);
drop function if exists public.get_campus_count(double precision, double precision);
drop function if exists public.get_public_profiles(uuid[]);
drop function if exists public.send_connection_request(uuid, text);
drop function if exists public.respond_connection_request(uuid, boolean);
drop function if exists public.send_request(uuid, text, text);
drop function if exists public.respond_request(uuid, boolean);
drop function if exists public.respond_request(uuid, boolean, boolean);
drop function if exists public.block_user(uuid);
drop function if exists public.send_message(uuid, text);
drop function if exists public.get_connection_link(uuid);
drop function if exists public.konekt_cleanup();

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  first_name       text not null,
  headline         text,
  avatar_url       text,
  linkedin_url     text,
  instagram_handle text,
  is_visible       boolean not null default true,
  lat              double precision,
  lng              double precision,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- v1 → v2 upgrade
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_active') then
    alter table public.profiles rename column is_active to is_visible;
  end if;
end $$;
alter table public.profiles add column if not exists headline text;
alter table public.profiles drop column if exists avatar_source;
drop index if exists public.profiles_discovery_idx;

alter table public.profiles drop constraint if exists profiles_first_name_check;
alter table public.profiles drop constraint if exists profiles_linkedin_url_check;
alter table public.profiles drop constraint if exists profiles_instagram_handle_check;
alter table public.profiles drop constraint if exists profiles_lat_check;
alter table public.profiles drop constraint if exists profiles_lng_check;
alter table public.profiles drop constraint if exists profiles_headline_check;
-- normalize v1 links to the canonical form the v2 constraint expects
update public.profiles
   set linkedin_url = case
         when linkedin_url ~* '/in/[^/?#]+' then 'https://www.linkedin.com/in/' || substring(linkedin_url from '(?i)/in/([^/?#]+)')
         else null end
 where linkedin_url is not null and linkedin_url !~* '^https://www\.linkedin\.com/in/[^/?#]+$';
alter table public.profiles
  add constraint profiles_first_name_check       check (char_length(first_name) between 1 and 30),
  add constraint profiles_headline_check         check (headline is null or char_length(headline) <= 60),
  add constraint profiles_linkedin_url_check     check (linkedin_url is null or linkedin_url ~* '^https://www\.linkedin\.com/in/[^/?#]+$'),
  add constraint profiles_instagram_handle_check check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint profiles_lat_check              check (lat is null or lat between -90 and 90),
  add constraint profiles_lng_check              check (lng is null or lng between -180 and 180);

create index if not exists profiles_visible_idx on public.profiles (last_seen_at) where is_visible;

-- =====================================================================
-- 2. BLOCKS — mutual & permanent
-- =====================================================================
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- =====================================================================
-- 3. REQUESTS — LinkedIn / Instagram / first chat message (2-hour window)
-- =====================================================================
create table if not exists public.connection_requests (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  message     text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '2 hours'),
  check (sender_id <> receiver_id)
);

-- v1 → v2 upgrade
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'connection_requests' and column_name = 'platform') then
    alter table public.connection_requests rename column platform to kind;
  end if;
end $$;
alter table public.connection_requests add column if not exists message text;
alter table public.connection_requests drop constraint if exists connection_requests_platform_check;
alter table public.connection_requests drop constraint if exists connection_requests_kind_check;
alter table public.connection_requests drop constraint if exists connection_requests_status_check;
alter table public.connection_requests drop constraint if exists connection_requests_message_check;
alter table public.connection_requests
  add constraint connection_requests_kind_check    check (kind in ('linkedin', 'instagram', 'chat')),
  add constraint connection_requests_status_check  check (status in ('pending', 'accepted', 'expired')),
  add constraint connection_requests_message_check check (
    (kind = 'chat' and message is not null and char_length(message) between 1 and 500)
    or (kind <> 'chat' and message is null));

create index if not exists cr_receiver_idx on public.connection_requests (receiver_id, status);
create index if not exists cr_sender_idx   on public.connection_requests (sender_id, status);
drop index if exists public.cr_one_pending;
create unique index cr_one_pending on public.connection_requests (sender_id, receiver_id, kind) where status = 'pending';

-- =====================================================================
-- 4. CHATS — opened only by an approved chat request; deleted after 24h
-- =====================================================================
create table if not exists public.chats (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (user_a < user_b),
  unique (user_a, user_b)
);

-- =====================================================================
-- 5. MESSAGES — live inside a chat; deleted with it
-- =====================================================================
drop policy if exists "messages: participants read" on public.messages;
drop policy if exists "messages: send as self"      on public.messages;

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

-- v1 → v2 upgrade: v1 messages had no approved chat → remove them
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'messages' and column_name = 'chat_id') then
    delete from public.messages;
    alter table public.messages add column chat_id uuid not null references public.chats (id) on delete cascade;
  end if;
end $$;
alter table public.messages drop column if exists expires_at;

create index if not exists messages_chat_idx     on public.messages (chat_id, created_at);
create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at);

-- =====================================================================
-- 6. FEEDBACK & PUSH
-- =====================================================================
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  rating     int  not null check (rating between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 7. ROW LEVEL SECURITY
--    Direct table access is minimal. Everything that touches another
--    person goes through SECURITY DEFINER functions below.
-- =====================================================================
-- is_blocked is used by policies, so it is created here (and never dropped).
-- It lives in a "private" schema that the API does not expose, so nobody can
-- call it directly to find out who blocked them.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_blocked(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

alter table public.profiles            enable row level security;
alter table public.blocks              enable row level security;
alter table public.connection_requests enable row level security;
alter table public.chats               enable row level security;
alter table public.messages            enable row level security;
alter table public.feedback            enable row level security;
alter table public.push_subscriptions  enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "profiles: insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: delete own" on public.profiles for delete using (id = auth.uid());

drop policy if exists "blocks: read own" on public.blocks;
create policy "blocks: read own" on public.blocks for select using (blocker_id = auth.uid());

drop policy if exists "cr: participants read" on public.connection_requests;
create policy "cr: participants read" on public.connection_requests
  for select using (
    (receiver_id = auth.uid() and not private.is_blocked(sender_id, receiver_id))
    -- a blocked sender keeps seeing their own request "pending" until it
    -- times out naturally, so a block is indistinguishable from no answer
    or (sender_id = auth.uid() and (status = 'pending' or not private.is_blocked(sender_id, receiver_id))));

drop policy if exists "chats: participants read" on public.chats;
create policy "chats: participants read" on public.chats
  for select using (auth.uid() in (user_a, user_b) and expires_at > now());

create policy "messages: participants read" on public.messages
  for select using (exists (
    select 1 from public.chats c
    where c.id = chat_id and c.expires_at > now() and auth.uid() in (c.user_a, c.user_b)));

drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback for insert with check (user_id = auth.uid());

drop policy if exists "push: own" on public.push_subscriptions;
create policy "push: own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- 8. FUNCTIONS
-- =====================================================================

-- Haversine distance in meters
create or replace function public.konekt_distance(lat1 double precision, lng1 double precision,
                                                  lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- ---------------------------------------------------------------------
-- get_nearby_users — visible users ≤75m who pinged in the last 10 min.
-- Never returns linkedin_url / instagram_handle.
-- Anti-probing: the caller must be visible, have pinged in the last 5 min,
-- and query within 150m of their own last position. Distances rounded to 5m.
-- ---------------------------------------------------------------------
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
    select p.id, p.first_name, p.headline, p.avatar_url,
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

-- ---------------------------------------------------------------------
-- get_campus_count — how many OTHER visible users are active within 1 km.
-- Same anti-probing rules. Returns a number only.
-- ---------------------------------------------------------------------
create function public.get_campus_count(user_lat double precision, user_lng double precision)
returns int
language plpgsql stable security definer set search_path = public
as $$
declare
  me   public.profiles;
  dlat double precision := 1000 / 111320.0;
  dlng double precision;
  n    int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if me.id is null or not me.is_visible or me.lat is null
     or me.last_seen_at < now() - interval '5 minutes'
     or public.konekt_distance(me.lat, me.lng, user_lat, user_lng) > 150 then
    return 0;
  end if;
  dlng := 1000 / (111320.0 * greatest(cos(radians(user_lat)), 0.01));

  select count(*) into n
  from public.profiles p
  where p.is_visible
    and p.id <> me.id
    and p.lat is not null
    and p.last_seen_at > now() - interval '10 minutes'
    and p.lat between user_lat - dlat and user_lat + dlat
    and p.lng between user_lng - dlng and user_lng + dlng
    and public.konekt_distance(user_lat, user_lng, p.lat, p.lng) <= 1000
    and not private.is_blocked(me.id, p.id);
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- get_public_profiles — name/headline/photo for people you have a
-- request or chat with (and haven't blocked either way).
-- ---------------------------------------------------------------------
create function public.get_public_profiles(ids uuid[])
returns table (id uuid, first_name text, headline text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.first_name, p.headline, p.avatar_url
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

-- ---------------------------------------------------------------------
-- send_request — kind: 'linkedin' | 'instagram' | 'chat' (+ first message)
-- ---------------------------------------------------------------------
create function public.send_request(target uuid, req_kind text, first_message text default null)
returns public.connection_requests
language plpgsql volatile security definer set search_path = public
as $$
declare
  t   public.profiles;
  req public.connection_requests;
  msg text := nullif(btrim(first_message), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if target = auth.uid() then raise exception 'cannot request yourself'; end if;
  if req_kind not in ('linkedin', 'instagram', 'chat') then raise exception 'bad kind'; end if;

  select * into t from public.profiles where id = target;
  -- Same error for "blocked" and "gone" so blocks stay silent.
  if t.id is null or not t.is_visible or private.is_blocked(auth.uid(), target) then
    raise exception 'user unavailable';
  end if;

  if req_kind = 'linkedin'  and t.linkedin_url is null     then raise exception 'no linkedin'; end if;
  if req_kind = 'instagram' and t.instagram_handle is null then raise exception 'no instagram'; end if;
  if req_kind = 'chat' then
    if msg is null then raise exception 'first message required'; end if;
    msg := left(msg, 500);
    if exists (select 1 from public.chats c
               where c.user_a = least(auth.uid(), target) and c.user_b = greatest(auth.uid(), target)
                 and c.expires_at > now()) then
      raise exception 'chat already open';
    end if;
  else
    msg := null;
  end if;

  update public.connection_requests set status = 'expired'
   where sender_id = auth.uid() and receiver_id = target and kind = req_kind
     and status = 'pending' and expires_at <= now();

  insert into public.connection_requests (sender_id, receiver_id, kind, message)
  values (auth.uid(), target, req_kind, msg)
  on conflict (sender_id, receiver_id, kind) where status = 'pending' do nothing
  returning * into req;

  if req.id is null then
    select * into req from public.connection_requests
     where sender_id = auth.uid() and receiver_id = target and kind = req_kind and status = 'pending';
  end if;
  return req;
end;
$$;

-- ---------------------------------------------------------------------
-- respond_request — receiver approves. Approving a chat request opens a
-- 24h chat and posts the first message into it.
-- ---------------------------------------------------------------------
create function public.respond_request(request_id uuid, accept boolean, share_back boolean default false)
returns public.connection_requests
language plpgsql volatile security definer set search_path = public
as $$
declare
  req public.connection_requests;
  c   public.chats;
  a   uuid;
  b   uuid;
  mine_has   boolean;
  theirs_has boolean;
begin
  update public.connection_requests
     set status = case when accept and expires_at > now() then 'accepted' else 'expired' end
   where id = request_id
     and receiver_id = auth.uid()
     and status = 'pending'
     and not private.is_blocked(sender_id, receiver_id)
  returning * into req;

  if req.id is null then raise exception 'request not found or already handled'; end if;

  if req.status = 'accepted' and req.kind = 'chat' then
    a := least(req.sender_id, req.receiver_id);
    b := greatest(req.sender_id, req.receiver_id);
    delete from public.chats where user_a = a and user_b = b and expires_at <= now();
    insert into public.chats (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set user_a = excluded.user_a  -- keep the open chat
    returning * into c;
    insert into public.messages (chat_id, sender_id, receiver_id, content)
    values (c.id, req.sender_id, req.receiver_id, req.message);
  end if;

  -- "Approve and share mine too": the person who asked for my link also hands me theirs.
  -- The requester only exposed their own link by asking (the send sheet says so), and only
  -- if they have one. It is recorded as an already-approved request from me to them, so
  -- get_connection_link works for me exactly as it does for any approved request.
  if req.status = 'accepted' and share_back and req.kind in ('linkedin', 'instagram') then
    select case req.kind when 'linkedin' then p.linkedin_url is not null else p.instagram_handle is not null end
      into mine_has   from public.profiles p where p.id = req.receiver_id;
    select case req.kind when 'linkedin' then p.linkedin_url is not null else p.instagram_handle is not null end
      into theirs_has from public.profiles p where p.id = req.sender_id;

    if coalesce(mine_has, false) and coalesce(theirs_has, false) then
      -- my own still-pending request for the same thing is replaced by the approved one
      update public.connection_requests set status = 'expired'
       where sender_id = req.receiver_id and receiver_id = req.sender_id
         and kind = req.kind and status = 'pending';
      if not exists (select 1 from public.connection_requests
                      where sender_id = req.receiver_id and receiver_id = req.sender_id
                        and kind = req.kind and status = 'accepted'
                        and created_at > now() - interval '48 hours') then
        insert into public.connection_requests (sender_id, receiver_id, kind, status)
        values (req.receiver_id, req.sender_id, req.kind, 'accepted');
      end if;
    end if;
  end if;
  return req;
end;
$$;

-- ---------------------------------------------------------------------
-- block_user — "התעלם / חסום". Mutual & permanent; silent for the other side.
-- Hides incoming requests, withdraws outgoing ones, deletes any chat between the two.
-- ---------------------------------------------------------------------
create function public.block_user(target uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null or target = auth.uid() then raise exception 'bad target'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target)
  on conflict do nothing;
  -- the blocker's own outgoing requests are withdrawn; incoming ones are
  -- left to time out on their own (approval is impossible once blocked)
  update public.connection_requests set status = 'expired'
   where status = 'pending' and sender_id = auth.uid() and receiver_id = target;
  delete from public.chats
   where user_a = least(auth.uid(), target) and user_b = greatest(auth.uid(), target);
end;
$$;

-- ---------------------------------------------------------------------
-- send_message — only inside an open, unexpired, unblocked chat.
-- ---------------------------------------------------------------------
create function public.send_message(chat uuid, body text)
returns public.messages
language plpgsql volatile security definer set search_path = public
as $$
declare
  c    public.chats;
  other uuid;
  m    public.messages;
  txt  text := left(btrim(coalesce(body, '')), 1000);
begin
  if txt = '' then raise exception 'empty message'; end if;
  select * into c from public.chats
   where id = chat and expires_at > now() and auth.uid() in (user_a, user_b);
  if c.id is null then raise exception 'chat not available'; end if;
  other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  if private.is_blocked(auth.uid(), other) then raise exception 'chat not available'; end if;

  insert into public.messages (chat_id, sender_id, receiver_id, content)
  values (c.id, auth.uid(), other, txt)
  returning * into m;
  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- get_connection_link — reveals the receiver's link to the SENDER only,
-- only after approval, never if either side blocked.
-- ---------------------------------------------------------------------
create function public.get_connection_link(request_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case r.kind
           when 'linkedin'  then p.linkedin_url
           when 'instagram' then 'https://instagram.com/' || p.instagram_handle
         end
  from public.connection_requests r
  join public.profiles p on p.id = r.receiver_id
  where r.id = request_id
    and r.sender_id = auth.uid()
    and r.status = 'accepted'
    and r.kind in ('linkedin', 'instagram')
    and not private.is_blocked(r.sender_id, r.receiver_id);
$$;

-- ---------------------------------------------------------------------
-- konekt_cleanup — run every few minutes (pg_cron, see bottom)
-- ---------------------------------------------------------------------
create function public.konekt_cleanup()
returns void
language sql security definer set search_path = public
as $$
  -- lapsed requests
  update public.connection_requests set status = 'expired'
   where status = 'pending' and expires_at <= now();
  -- approved chats auto-delete after 24h (messages cascade)
  delete from public.chats where expires_at <= now();
  -- radar presence expires after 10 min: forget stale coordinates
  update public.profiles set lat = null, lng = null
   where lat is not null and last_seen_at < now() - interval '10 minutes';
  -- old handled requests
  delete from public.connection_requests
   where status <> 'pending' and created_at < now() - interval '7 days';
$$;

-- ---------------------------------------------------------------------
-- Permissions: only signed-in users may call the RPCs
-- ---------------------------------------------------------------------
revoke all on function private.is_blocked(uuid, uuid)                                           from public, anon;
revoke all on function public.get_nearby_users(double precision, double precision, double precision) from public, anon;
revoke all on function public.get_campus_count(double precision, double precision)              from public, anon;
revoke all on function public.get_public_profiles(uuid[])                                       from public, anon;
revoke all on function public.send_request(uuid, text, text)                                    from public, anon;
revoke all on function public.respond_request(uuid, boolean, boolean)                              from public, anon;
revoke all on function public.block_user(uuid)                                                  from public, anon;
revoke all on function public.send_message(uuid, text)                                          from public, anon;
revoke all on function public.get_connection_link(uuid)                                         from public, anon;
revoke all on function public.konekt_cleanup()                                                  from public, anon, authenticated;

grant execute on function private.is_blocked(uuid, uuid)                                            to authenticated;
grant execute on function public.get_nearby_users(double precision, double precision, double precision) to authenticated;
grant execute on function public.get_campus_count(double precision, double precision)              to authenticated;
grant execute on function public.get_public_profiles(uuid[])                                       to authenticated;
grant execute on function public.send_request(uuid, text, text)                                    to authenticated;
grant execute on function public.respond_request(uuid, boolean, boolean)                              to authenticated;
grant execute on function public.block_user(uuid)                                                  to authenticated;
grant execute on function public.send_message(uuid, text)                                          to authenticated;
grant execute on function public.get_connection_link(uuid)                                         to authenticated;

-- Clients never write these tables directly (only via the functions above).
revoke insert, update, delete on public.connection_requests, public.chats, public.messages, public.blocks
  from anon, authenticated;

-- =====================================================================
-- 9. REALTIME
-- =====================================================================
do $$
begin
  begin alter publication supabase_realtime add table public.messages;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.connection_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chats;               exception when duplicate_object then null; end;
end $$;

-- =====================================================================
-- 10. STORAGE — public "avatars" bucket, each user writes only to <uid>/...
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: upload own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 11. SCHEDULED CLEANUP (recommended)
--     Dashboard → Database → Extensions → enable pg_cron, then run:
-- =====================================================================
-- select cron.schedule('konekt-cleanup', '*/5 * * * *', $$ select public.konekt_cleanup(); $$);
