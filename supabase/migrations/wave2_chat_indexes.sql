-- =====================================================================
--  KONEKT — Wave 2: indexes for the columns that row level security and the
--  chat / radar queries filter on, and a re-assertion of the realtime publication.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run, in any order:
--  every statement is skipped (with a NOTICE) when its table does not exist yet.
--
--  The tables themselves are created by earlier migrations:
--    message_reactions, group_polls, group_poll_options, group_poll_votes  → chat_engagement.sql
--    groups, group_members, group_messages                                  → private_groups.sql
--  Run those FIRST, then this file (or run this file again afterwards to add what was skipped).
--  The typing indicator uses Realtime Broadcast: ephemeral, no table, no migration.
-- =====================================================================

do $$
declare
  ix   text[];
  t    text;
  ddl  text;
  tbl  text;
  skipped text[] := '{}';
begin
  -- { table, create-index statement }
  foreach ix slice 1 in array array[
    -- direct chats: every RLS check and every load filters on these
    array['chats',              'create index if not exists chats_user_a_idx on public.chats (user_a)'],
    array['chats',              'create index if not exists chats_user_b_idx on public.chats (user_b)'],
    array['messages',           'create index if not exists messages_chat_created_idx on public.messages (chat_id, created_at)'],
    array['messages',           'create index if not exists messages_receiver_idx on public.messages (receiver_id)'],
    -- rooms: membership checks (private.is_group_member) and the message stream
    array['group_members',      'create index if not exists group_members_user_idx on public.group_members (user_id)'],
    array['group_members',      'create index if not exists group_members_group_idx on public.group_members (group_id)'],
    array['group_messages',     'create index if not exists group_messages_group_created_idx on public.group_messages (group_id, created_at)'],
    array['groups',             'create index if not exists groups_created_by_idx on public.groups (created_by)'],
    -- reactions, polls and votes: the RLS sub-selects and the realtime filters
    array['message_reactions',  'create index if not exists message_reactions_user_idx on public.message_reactions (user_id)'],
    array['group_poll_votes',   'create index if not exists group_poll_votes_option_idx on public.group_poll_votes (option_id)'],
    array['group_poll_votes',   'create index if not exists group_poll_votes_user_idx on public.group_poll_votes (user_id)'],
    array['group_messages',     'create index if not exists group_messages_poll_idx on public.group_messages (poll_id) where poll_id is not null'],
    -- radar: only people with a position are ever candidates
    array['profiles',           'create index if not exists profiles_radar_idx on public.profiles (last_seen_at desc) where lat is not null and is_visible']
  ] loop
    tbl := ix[1];
    ddl := ix[2];
    if to_regclass('public.' || tbl) is null then
      skipped := skipped || tbl;
      continue;
    end if;
    begin
      execute ddl;
    exception when undefined_column then
      raise notice 'skipped (column missing, run the earlier migrations): %', ddl;
    end;
  end loop;

  -- Realtime: everything a chat screen listens to must be in the publication (already-added tables are ignored)
  foreach t in array array['messages', 'group_messages', 'group_members', 'groups', 'message_reactions', 'group_poll_votes'] loop
    if to_regclass('public.' || t) is null then
      skipped := skipped || t;
      continue;
    end if;
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;

  if cardinality(skipped) > 0 then
    raise notice 'Skipped because these tables do not exist yet: %. Run chat_engagement.sql / private_groups.sql first, then run this file again.',
      (select string_agg(distinct s, ', ') from unnest(skipped) s);
  end if;
end $$;

notify pgrst, 'reload schema';
