-- =====================================================================
--  KONEKT — live chat engagement: message reactions, quick polls in rooms,
--  a pinned message per room, and realtime for all of it.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: supabase_schema.sql, migrations/private_groups.sql, rooms_invites.sql.
--
--  Same model as the rest of the app: tables are readable (RLS) only by the people in
--  the chat / room; every write goes through a SECURITY DEFINER function.
--  Realtime note: DELETE events are not filtered by RLS, so nothing here relies on them
--  (removing a reaction is an UPDATE to NULL; votes can be changed, not removed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Reactions (one per person per message; direct chats AND rooms)
-- ---------------------------------------------------------------------
create table if not exists public.message_reactions (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid references public.messages (id) on delete cascade,
  group_message_id uuid references public.group_messages (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  emoji            text check (emoji is null or char_length(emoji) between 1 and 8),  -- NULL = reaction removed
  created_at       timestamptz not null default now(),
  check ((message_id is not null) <> (group_message_id is not null))
);
create unique index if not exists message_reactions_direct_uidx on public.message_reactions (message_id, user_id)       where message_id is not null;
create unique index if not exists message_reactions_group_uidx  on public.message_reactions (group_message_id, user_id) where group_message_id is not null;

-- ---------------------------------------------------------------------
-- 2. Quick polls inside rooms
-- ---------------------------------------------------------------------
create table if not exists public.group_polls (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  question   text not null check (char_length(question) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists group_polls_group_idx on public.group_polls (group_id);

create table if not exists public.group_poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.group_polls (id) on delete cascade,
  position int  not null,
  label    text not null check (char_length(label) between 1 and 40),
  unique (poll_id, position)
);

create table if not exists public.group_poll_votes (
  poll_id   uuid not null references public.group_polls (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  option_id uuid not null references public.group_poll_options (id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- a poll lives in the message stream: a group_messages row of kind 'poll'
alter table public.group_messages add column if not exists poll_id uuid references public.group_polls (id) on delete cascade;
alter table public.group_messages drop constraint if exists group_messages_kind_check;
alter table public.group_messages add constraint group_messages_kind_check check (kind in ('text', 'linkedin', 'poll'));

-- ---------------------------------------------------------------------
-- 3. One pinned message per room (only the creator can change it)
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists pinned_message_id uuid references public.group_messages (id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Row level security: readable by the participants only, never writable directly
-- ---------------------------------------------------------------------
alter table public.message_reactions  enable row level security;
alter table public.group_polls        enable row level security;
alter table public.group_poll_options enable row level security;
alter table public.group_poll_votes   enable row level security;

drop policy if exists "reactions: participants read" on public.message_reactions;
drop policy if exists "polls: members read"          on public.group_polls;
drop policy if exists "poll options: members read"   on public.group_poll_options;
drop policy if exists "poll votes: members read"     on public.group_poll_votes;

-- The sub-selects run under the caller's own RLS: you can only see a reaction if you can see its message
-- (direct: a participant of a live chat; room: a member, and the sender not blocked).
create policy "reactions: participants read" on public.message_reactions
  for select using (
    (message_id is not null       and exists (select 1 from public.messages m        where m.id  = message_id))
    or (group_message_id is not null and exists (select 1 from public.group_messages gm where gm.id = group_message_id)));

create policy "polls: members read" on public.group_polls
  for select using (private.is_group_member(group_id, auth.uid()));

create policy "poll options: members read" on public.group_poll_options
  for select using (exists (select 1 from public.group_polls p where p.id = poll_id));

create policy "poll votes: members read" on public.group_poll_votes
  for select using (exists (select 1 from public.group_polls p where p.id = poll_id));

revoke all on public.message_reactions, public.group_polls, public.group_poll_options, public.group_poll_votes from anon, authenticated;
grant select on public.message_reactions, public.group_polls, public.group_poll_options, public.group_poll_votes to authenticated;

-- ---------------------------------------------------------------------
-- 5. Functions
-- ---------------------------------------------------------------------
drop function if exists public.react_to_message(uuid, uuid, text);
drop function if exists public.create_group_poll(uuid, text, text[]);
drop function if exists public.vote_group_poll(uuid, uuid);
drop function if exists public.pin_group_message(uuid, uuid);

-- react_to_message — pass the id of a direct message OR of a room message, and one of the six quick emojis.
-- Same emoji again removes your reaction; a different one replaces it. Returns your reaction afterwards (NULL = none).
create function public.react_to_message(p_message uuid default null, p_group_message uuid default null, p_emoji text default null)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  base       text := replace(coalesce(p_emoji, ''), chr(65039), '');
  cur        text;
  had_row    boolean;
  next_emoji text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (p_message is null) = (p_group_message is null) then raise exception 'one message required'; end if;
  -- the six quick reactions (thumbs up, red heart, fire, joy, raised hands, coffee), as code points so nothing invisible can get lost in a copy-paste
  if base <> all (array[chr(128077), chr(10084), chr(128293), chr(128514), chr(128588), chr(9749)]) then raise exception 'bad emoji'; end if;

  if p_message is not null then
    if not exists (select 1 from public.messages m join public.chats c on c.id = m.chat_id
                    where m.id = p_message and auth.uid() in (m.sender_id, m.receiver_id) and c.expires_at > now()) then
      raise exception 'message not available';
    end if;
    select r.emoji into cur from public.message_reactions r where r.message_id = p_message and r.user_id = auth.uid();
    had_row := found;
    next_emoji := case when had_row and replace(coalesce(cur, ''), chr(65039), '') = base then null else p_emoji end;
    if had_row then
      update public.message_reactions set emoji = next_emoji where message_id = p_message and user_id = auth.uid();
    else
      insert into public.message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji);
    end if;
  else
    if not exists (select 1 from public.group_messages gm
                    where gm.id = p_group_message
                      and private.is_group_member(gm.group_id, auth.uid())
                      and not private.is_blocked(auth.uid(), gm.sender_id)) then
      raise exception 'message not available';
    end if;
    select r.emoji into cur from public.message_reactions r where r.group_message_id = p_group_message and r.user_id = auth.uid();
    had_row := found;
    next_emoji := case when had_row and replace(coalesce(cur, ''), chr(65039), '') = base then null else p_emoji end;
    if had_row then
      update public.message_reactions set emoji = next_emoji where group_message_id = p_group_message and user_id = auth.uid();
    else
      insert into public.message_reactions (group_message_id, user_id, emoji) values (p_group_message, auth.uid(), p_emoji);
    end if;
  end if;
  return next_emoji;
end;
$$;

-- create_group_poll — any member: a question (≤80) and 2-4 options (≤40 each). Posts the poll into the room.
create function public.create_group_poll(grp uuid, poll_question text, poll_options text[])
returns public.group_messages
language plpgsql volatile security definer set search_path = public
as $$
declare
  q    text := btrim(coalesce(poll_question, ''));
  opts text[];
  p    public.group_polls;
  m    public.group_messages;
  i    int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not private.is_group_member(grp, auth.uid()) then raise exception 'group not available'; end if;
  if char_length(q) not between 1 and 80 then raise exception 'bad question'; end if;

  select coalesce(array_agg(btrim(o) order by n), '{}') into opts
    from unnest(coalesce(poll_options, '{}')) with ordinality as t(o, n)
   where btrim(o) <> '';
  if cardinality(opts) not between 2 and 4 then raise exception 'bad options'; end if;
  for i in 1 .. cardinality(opts) loop
    if char_length(opts[i]) > 40 then raise exception 'bad option'; end if;
  end loop;

  insert into public.group_polls (group_id, created_by, question) values (grp, auth.uid(), q) returning * into p;
  insert into public.group_poll_options (poll_id, position, label)
    select p.id, n::int, o from unnest(opts) with ordinality as t(o, n);
  insert into public.group_messages (group_id, sender_id, content, kind, poll_id)
    values (grp, auth.uid(), q, 'poll', p.id) returning * into m;
  return m;
end;
$$;

-- vote_group_poll — one vote per member; voting again changes it.
create function public.vote_group_poll(p_poll uuid, p_option uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select p.group_id into g
    from public.group_polls p join public.group_poll_options o on o.poll_id = p.id
   where p.id = p_poll and o.id = p_option;
  if g is null then raise exception 'poll not found'; end if;
  if not private.is_group_member(g, auth.uid()) then raise exception 'group not available'; end if;
  insert into public.group_poll_votes (poll_id, user_id, option_id) values (p_poll, auth.uid(), p_option)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

-- pin_group_message — only the room's creator. msg = NULL removes the pin.
create function public.pin_group_message(grp uuid, msg uuid default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.groups g where g.id = grp and g.created_by = auth.uid())
     or not private.is_group_member(grp, auth.uid()) then
    raise exception 'only the room creator can pin';
  end if;
  if msg is not null and not exists (select 1 from public.group_messages gm where gm.id = msg and gm.group_id = grp) then
    raise exception 'message not found';
  end if;
  update public.groups set pinned_message_id = msg where id = grp;
end;
$$;

revoke all on function public.react_to_message(uuid, uuid, text)       from public, anon;
revoke all on function public.create_group_poll(uuid, text, text[])    from public, anon;
revoke all on function public.vote_group_poll(uuid, uuid)              from public, anon;
revoke all on function public.pin_group_message(uuid, uuid)            from public, anon;
grant execute on function public.react_to_message(uuid, uuid, text)    to authenticated;
grant execute on function public.create_group_poll(uuid, text, text[]) to authenticated;
grant execute on function public.vote_group_poll(uuid, uuid)           to authenticated;
grant execute on function public.pin_group_message(uuid, uuid)         to authenticated;

-- ---------------------------------------------------------------------
-- 6. Realtime: everything a chat screen listens to must be in the publication.
--    (Adding a table that is already there raises duplicate_object, which is ignored.)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.messages;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_messages;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.groups;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.message_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_poll_votes;  exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
