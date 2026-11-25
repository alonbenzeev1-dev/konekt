-- =====================================================================
--  KONEKT — persist "read" state on the server, so unread badges survive
--  reloads, new devices and the installed (separate-storage) PWA.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires the main schema and migrations/private_groups.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Group chats: when did each member last read the group?
--    Existing members get "now" (everything so far counts as read).
-- ---------------------------------------------------------------------
alter table public.group_members add column if not exists last_read_at timestamptz default now();
update public.group_members set last_read_at = now() where last_read_at is null;

-- members may update ONLY their own row's share_socials / last_read_at (policy from private_groups.sql)
grant update (last_read_at) on public.group_members to authenticated;

-- ---------------------------------------------------------------------
-- 2. 1-on-1 chats: one private row per (chat, reader). Deleted with the chat
--    (chats expire after 24h), and only the reader can ever see their own row,
--    so nobody learns when someone else read their message.
-- ---------------------------------------------------------------------
create table if not exists public.chat_reads (
  chat_id      uuid not null references public.chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_reads_user_idx on public.chat_reads (user_id);

alter table public.chat_reads enable row level security;

drop policy if exists "chat_reads: read own"   on public.chat_reads;
drop policy if exists "chat_reads: insert own" on public.chat_reads;
drop policy if exists "chat_reads: update own" on public.chat_reads;

create policy "chat_reads: read own" on public.chat_reads
  for select using (user_id = auth.uid());
create policy "chat_reads: insert own" on public.chat_reads
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.chats c where c.id = chat_id and auth.uid() in (c.user_a, c.user_b)));
create policy "chat_reads: update own" on public.chat_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.chat_reads from anon, authenticated;
grant select, insert, update on public.chat_reads to authenticated;

-- Chats that already exist: everything in them so far counts as read, for both people.
insert into public.chat_reads (chat_id, user_id, last_read_at)
select c.id, u, now() from public.chats c, unnest(array[c.user_a, c.user_b]) as u
on conflict (chat_id, user_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Functions. The app calls these so the timestamp comes from the
--    server clock (the same clock that stamps message created_at).
-- ---------------------------------------------------------------------
drop function if exists public.mark_chat_read(uuid);
drop function if exists public.mark_group_read(uuid);

create function public.mark_chat_read(chat uuid)
returns timestamptz
language plpgsql volatile security definer set search_path = public
as $$
declare ts timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.chats c where c.id = chat and auth.uid() in (c.user_a, c.user_b)) then
    raise exception 'chat not available';
  end if;
  insert into public.chat_reads (chat_id, user_id, last_read_at) values (chat, auth.uid(), now())
  on conflict (chat_id, user_id)
    do update set last_read_at = greatest(public.chat_reads.last_read_at, excluded.last_read_at)
  returning last_read_at into ts;
  return ts;
end;
$$;

create function public.mark_group_read(grp uuid)
returns timestamptz
language plpgsql volatile security definer set search_path = public
as $$
declare ts timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.group_members
     set last_read_at = greatest(coalesce(last_read_at, now()), now())
   where group_id = grp and user_id = auth.uid()
  returning last_read_at into ts;
  if ts is null then raise exception 'group not available'; end if;
  return ts;
end;
$$;

revoke all on function public.mark_chat_read(uuid)  from public, anon;
revoke all on function public.mark_group_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid)  to authenticated;
grant execute on function public.mark_group_read(uuid) to authenticated;

notify pgrst, 'reload schema';
