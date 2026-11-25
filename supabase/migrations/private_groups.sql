-- =====================================================================
--  KONEKT — Private group chats + opt-in social sharing inside a group
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires the main schema (supabase_schema.sql) to be applied first.
--
--  Same model as the rest of the app: tables are readable through RLS,
--  every write goes through a SECURITY DEFINER function, except a member
--  toggling their OWN share_socials flag.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id      uuid not null references public.groups (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  share_socials boolean not null default false,
  joined_at     timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at);

-- ---------------------------------------------------------------------
-- 2. Membership helper. SECURITY DEFINER so policies can use it without
--    recursing into group_members' own RLS. Lives in the unexposed
--    "private" schema (created by the main schema).
-- ---------------------------------------------------------------------
create or replace function private.is_group_member(gid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = uid);
$$;
revoke all on function private.is_group_member(uuid, uuid) from public, anon;
grant execute on function private.is_group_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists "groups: members read"        on public.groups;
drop policy if exists "group_members: members read" on public.group_members;
drop policy if exists "group_members: toggle own share" on public.group_members;
drop policy if exists "group_messages: members read" on public.group_messages;

create policy "groups: members read" on public.groups
  for select using (private.is_group_member(id, auth.uid()));

create policy "group_members: members read" on public.group_members
  for select using (private.is_group_member(group_id, auth.uid()));

create policy "group_members: toggle own share" on public.group_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- members read messages; a message from someone you blocked (or who blocked you) stays hidden
create policy "group_messages: members read" on public.group_messages
  for select using (
    private.is_group_member(group_id, auth.uid())
    and not private.is_blocked(auth.uid(), sender_id));

-- No direct writes, except the member's own share_socials column.
revoke all on public.groups, public.group_members, public.group_messages from anon, authenticated;
grant select on public.groups, public.group_members, public.group_messages to authenticated;
grant update (share_socials) on public.group_members to authenticated;

-- ---------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------
drop function if exists public.create_group(text, uuid[]);
drop function if exists public.send_group_message(uuid, text);
drop function if exists public.get_group_members(uuid);

-- create_group — creator + initial members. Every added person must be a
-- connection (an approved request either way) or visible and within 150 m
-- right now; never someone blocked. Max 30 people.
create function public.create_group(group_name text, member_ids uuid[])
returns public.groups
language plpgsql volatile security definer set search_path = public
as $$
declare
  me  public.profiles;
  g   public.groups;
  nm  text := btrim(coalesce(group_name, ''));
  ids uuid[];
  m   uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(nm) not between 1 and 40 then raise exception 'bad name'; end if;
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'no profile'; end if;

  select coalesce(array_agg(distinct x), '{}') into ids
    from unnest(coalesce(member_ids, '{}')) as x where x <> auth.uid();
  if cardinality(ids) > 29 then raise exception 'too many members'; end if;

  foreach m in array ids loop
    if private.is_blocked(auth.uid(), m) or not exists (select 1 from public.profiles where id = m) then
      raise exception 'user unavailable';
    end if;
    if not (
      exists (select 1 from public.connection_requests r
              where r.status = 'accepted'
                and ((r.sender_id = auth.uid() and r.receiver_id = m)
                  or (r.sender_id = m and r.receiver_id = auth.uid())))
      or exists (select 1 from public.profiles p
                 where p.id = m and p.is_visible and p.lat is not null
                   and p.last_seen_at > now() - interval '10 minutes'
                   and me.is_visible and me.lat is not null
                   and me.last_seen_at > now() - interval '5 minutes'
                   and public.konekt_distance(me.lat, me.lng, p.lat, p.lng) <= 150)
    ) then
      raise exception 'user unavailable';
    end if;
  end loop;

  insert into public.groups (name, created_by) values (nm, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  insert into public.group_members (group_id, user_id) select g.id, x from unnest(ids) as x;
  return g;
end;
$$;

-- send_group_message — members only
create function public.send_group_message(grp uuid, body text)
returns public.group_messages
language plpgsql volatile security definer set search_path = public
as $$
declare
  txt text := left(btrim(coalesce(body, '')), 1000);
  m   public.group_messages;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if txt = '' then raise exception 'empty message'; end if;
  if not private.is_group_member(grp, auth.uid()) then raise exception 'group not available'; end if;
  insert into public.group_messages (group_id, sender_id, content)
  values (grp, auth.uid(), txt) returning * into m;
  return m;
end;
$$;

-- get_group_members — name/avatar of every member, plus linkedin_url /
-- instagram_handle ONLY for members who turned share_socials on. This is
-- how fellow members "read" those two fields; the profiles table itself
-- stays private, so lat/lng and everything else are never exposed.
create function public.get_group_members(grp uuid)
returns table (
  member_id        uuid,
  first_name       text,
  headline         text,
  avatar_url       text,
  share_socials    boolean,
  linkedin_url     text,
  instagram_handle text
)
language sql stable security definer set search_path = public
as $$
  select gm.user_id, p.first_name, p.headline, p.avatar_url, gm.share_socials,
         case when gm.share_socials then p.linkedin_url end,
         case when gm.share_socials then p.instagram_handle end
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = grp
    and private.is_group_member(grp, auth.uid())
    and not private.is_blocked(auth.uid(), gm.user_id)
  order by gm.joined_at, p.first_name;
$$;

revoke all on function public.create_group(text, uuid[])    from public, anon;
revoke all on function public.send_group_message(uuid, text) from public, anon;
revoke all on function public.get_group_members(uuid)        from public, anon;
grant execute on function public.create_group(text, uuid[])    to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.get_group_members(uuid)        to authenticated;

-- ---------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.group_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members;  exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
