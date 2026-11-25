-- =====================================================================
--  KONEKT — groups become "groups & rooms": description + place tag,
--  QR / link invites, bigger rooms, LinkedIn cards posted into a room.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: supabase_schema.sql, migrations/private_groups.sql,
--            (and, if you use them) read_state.sql, mutual_approval.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists description text
  check (description is null or char_length(description) <= 160);
alter table public.groups add column if not exists location_tag text
  check (location_tag is null or char_length(location_tag) <= 40);

-- Invite code = the secret in https://konekt-nu.vercel.app/?join=<code>.
-- 12 hex chars from gen_random_uuid() (a CSPRNG), unique, generated per row (existing groups get one too).
alter table public.groups add column if not exists invite_code text not null
  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
create unique index if not exists groups_invite_code_key on public.groups (invite_code);

-- Instagram is shared separately from LinkedIn. share_socials keeps meaning "LinkedIn shared";
-- people who had already shared both keep sharing both (done once, when the column is created).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'group_members' and column_name = 'share_instagram') then
    alter table public.group_members add column share_instagram boolean not null default false;
    update public.group_members set share_instagram = share_socials;
  end if;
end $$;
grant update (share_instagram) on public.group_members to authenticated;

-- a message can be a LinkedIn card (rendered from the sender's shared link) instead of plain text
alter table public.group_messages add column if not exists kind text not null default 'text'
  check (kind in ('text', 'linkedin'));

-- ---------------------------------------------------------------------
-- 2. Functions (all replaced; the old shapes are dropped first)
-- ---------------------------------------------------------------------
drop function if exists public.create_group(text, uuid[]);
drop function if exists public.create_group(text, uuid[], text, text);
drop function if exists public.add_group_members(uuid, uuid[]);
drop function if exists public.get_group_members(uuid);
drop function if exists public.preview_group_invite(text);
drop function if exists public.join_group_by_code(text);
drop function if exists public.share_linkedin_in_group(uuid);

-- create_group — name, optional description / place ("בניין רקנאטי"), optional first members.
-- Rooms can be big (a lecture, an event): up to 200 people.
create function public.create_group(
  group_name        text,
  member_ids        uuid[] default '{}',
  group_description text   default null,
  group_location    text   default null
)
returns public.groups
language plpgsql volatile security definer set search_path = public
as $$
declare
  g     public.groups;
  nm    text := btrim(coalesce(group_name, ''));
  descr text := nullif(btrim(coalesce(group_description, '')), '');
  loc   text := nullif(btrim(coalesce(group_location, '')), '');
  ids   uuid[];
  m     uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(nm) not between 1 and 40 then raise exception 'bad name'; end if;
  if descr is not null and char_length(descr) > 160 then raise exception 'bad description'; end if;
  if loc is not null and char_length(loc) > 40 then raise exception 'bad location'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'no profile'; end if;

  select coalesce(array_agg(distinct x), '{}') into ids
    from unnest(coalesce(member_ids, '{}')) as x where x <> auth.uid();
  if cardinality(ids) > 199 then raise exception 'too many members'; end if;

  foreach m in array ids loop
    if not private.can_group_add(auth.uid(), m) then raise exception 'user unavailable'; end if;
  end loop;

  insert into public.groups (name, description, location_tag, created_by)
  values (nm, descr, loc, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  insert into public.group_members (group_id, user_id) select g.id, x from unnest(ids) as x;
  return g;
end;
$$;

-- add_group_members — unchanged rules, cap raised from 30 to 200.
create function public.add_group_members(grp uuid, member_ids uuid[])
returns integer
language plpgsql volatile security definer set search_path = public
as $$
declare
  ids uuid[];
  m   uuid;
  cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not private.is_group_member(grp, auth.uid()) then raise exception 'group not available'; end if;
  perform 1 from public.groups where id = grp for update;  -- serialize concurrent adds so the cap holds

  select coalesce(array_agg(distinct x), '{}') into ids
    from unnest(coalesce(member_ids, '{}')) as x
   where not exists (select 1 from public.group_members gm where gm.group_id = grp and gm.user_id = x);
  if cardinality(ids) = 0 then return 0; end if;

  select count(*) into cnt from public.group_members where group_id = grp;
  if cnt + cardinality(ids) > 200 then raise exception 'too many members'; end if;

  foreach m in array ids loop
    if not private.can_group_add(auth.uid(), m) then raise exception 'user unavailable'; end if;
  end loop;

  insert into public.group_members (group_id, user_id) select grp, x from unnest(ids) as x;
  return cardinality(ids);
end;
$$;

-- get_group_members — name, photo and headline of EVERY member, whatever their "visible on the radar"
-- setting says (being in the room is the consent). LinkedIn / Instagram only when that member chose to
-- share them in this room. The profiles table itself stays private.
create function public.get_group_members(grp uuid)
returns table (
  member_id        uuid,
  first_name       text,
  headline         text,
  avatar_url       text,
  share_socials    boolean,
  share_instagram  boolean,
  linkedin_url     text,
  instagram_handle text
)
language sql stable security definer set search_path = public
as $$
  select gm.user_id, p.first_name, p.headline, p.avatar_url, gm.share_socials, gm.share_instagram,
         case when gm.share_socials   then p.linkedin_url end,
         case when gm.share_instagram then p.instagram_handle end
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = grp
    and private.is_group_member(grp, auth.uid())
    and not private.is_blocked(auth.uid(), gm.user_id)
  order by gm.joined_at, p.first_name;
$$;

-- preview_group_invite — what the "join this room?" prompt shows. Reveals only name / description /
-- place / head-count for a valid code (no member list, no group id unless you are already in).
create function public.preview_group_invite(code text)
returns table (
  name           text,
  description    text,
  location_tag   text,
  member_count   integer,
  already_member boolean,
  group_id       uuid
)
language sql stable security definer set search_path = public
as $$
  select g.name, g.description, g.location_tag,
         (select count(*)::int from public.group_members m where m.group_id = g.id),
         private.is_group_member(g.id, auth.uid()),
         case when private.is_group_member(g.id, auth.uid()) then g.id end
  from public.groups g
  where auth.uid() is not null
    and g.invite_code = lower(btrim(code));
$$;

-- join_group_by_code — joins the signed-in user (idempotent) and returns the group.
create function public.join_group_by_code(code text)
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
    select count(*) into cnt from public.group_members where group_id = g.id;
    if cnt >= 200 then raise exception 'too many members'; end if;
    insert into public.group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  end if;
  return g;
end;
$$;

-- share_linkedin_in_group — "שתף את ה-LinkedIn שלי בחדר": marks my LinkedIn as shared in this room
-- and posts a LinkedIn card into the chat (once; pressing it again does not post a duplicate).
create function public.share_linkedin_in_group(grp uuid)
returns public.group_messages
language plpgsql volatile security definer set search_path = public
as $$
declare
  was_shared boolean;
  has_link   boolean;
  m          public.group_messages;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select gm.share_socials into was_shared
    from public.group_members gm where gm.group_id = grp and gm.user_id = auth.uid();
  if was_shared is null then raise exception 'group not available'; end if;
  select (p.linkedin_url is not null) into has_link from public.profiles p where p.id = auth.uid();
  if not coalesce(has_link, false) then raise exception 'no linkedin'; end if;

  update public.group_members set share_socials = true where group_id = grp and user_id = auth.uid();

  if was_shared then
    select * into m from public.group_messages
     where group_id = grp and sender_id = auth.uid() and kind = 'linkedin'
     order by created_at desc limit 1;
    if m.id is not null then return m; end if;
  end if;

  insert into public.group_messages (group_id, sender_id, content, kind)
  values (grp, auth.uid(), 'שיתף/ה את ה-LinkedIn', 'linkedin')
  returning * into m;
  return m;
end;
$$;

revoke all on function public.create_group(text, uuid[], text, text) from public, anon;
revoke all on function public.add_group_members(uuid, uuid[])          from public, anon;
revoke all on function public.get_group_members(uuid)                  from public, anon;
revoke all on function public.preview_group_invite(text)               from public, anon;
revoke all on function public.join_group_by_code(text)                 from public, anon;
revoke all on function public.share_linkedin_in_group(uuid)            from public, anon;
grant execute on function public.create_group(text, uuid[], text, text) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[])          to authenticated;
grant execute on function public.get_group_members(uuid)                  to authenticated;
grant execute on function public.preview_group_invite(text)               to authenticated;
grant execute on function public.join_group_by_code(text)                 to authenticated;
grant execute on function public.share_linkedin_in_group(uuid)            to authenticated;

notify pgrst, 'reload schema';
