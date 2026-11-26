-- =====================================================================
--  KONEKT — Wave 2: indexes for the columns that row level security and the
--  chat / radar queries filter on, and a re-assertion of the realtime publication.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: chat_engagement.sql (reactions, polls, votes, pinned message live there:
--  nothing in this file changes their tables or policies).
--
--  The typing indicator uses Realtime Broadcast: ephemeral, no table, no migration.
-- =====================================================================

-- Direct chats: every RLS check and every load filters on these.
create index if not exists chats_user_a_idx             on public.chats (user_a);
create index if not exists chats_user_b_idx             on public.chats (user_b);
create index if not exists messages_chat_created_idx    on public.messages (chat_id, created_at);
create index if not exists messages_receiver_idx        on public.messages (receiver_id);

-- Rooms: membership checks (private.is_group_member) and the message stream.
create index if not exists group_members_user_idx       on public.group_members (user_id);
create index if not exists group_members_group_idx      on public.group_members (group_id);
create index if not exists group_messages_group_created_idx on public.group_messages (group_id, created_at);
create index if not exists groups_created_by_idx        on public.groups (created_by);

-- Reactions, polls and votes: the RLS sub-selects and the realtime filters.
create index if not exists message_reactions_user_idx   on public.message_reactions (user_id);
create index if not exists group_poll_votes_option_idx  on public.group_poll_votes (option_id);
create index if not exists group_poll_votes_user_idx    on public.group_poll_votes (user_id);
create index if not exists group_messages_poll_idx      on public.group_messages (poll_id) where poll_id is not null;

-- Radar: only people with a position are ever candidates.
create index if not exists profiles_radar_idx           on public.profiles (last_seen_at desc) where lat is not null and is_visible;

-- Realtime: everything a chat screen listens to must be in the publication (already-added tables are ignored).
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
