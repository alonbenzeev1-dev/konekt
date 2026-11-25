import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertIncoming, toast } from '../lib/notify';
import { isLater, loadReads, mergeReads, saveReads, type ReadMap } from '../lib/reads';
import { isMissingFunction } from '../lib/rpc';
import { groupKey, toggledReaction, withReaction, type ReactionMap } from '../lib/reactions';
import { messagePreview } from '../lib/chatText';
import type { Group, GroupMember, GroupMessage, GroupPoll, PollOption, Reaction } from '../lib/types';

type PollRow = Omit<GroupPoll, 'options'> & { group_poll_options?: PollOption[] };
const toPoll = (row: PollRow): GroupPoll => {
  const { group_poll_options, ...rest } = row;
  return { ...rest, options: [...(group_poll_options ?? [])].sort((a, b) => a.position - b.position) };
};

/** Local mirror of group_members.last_read_at: fallback while offline / before the read_state migration. */
const GROUP_READ_KEY = 'konekt-group-read';

type Result = { error: string | null };

/** Rooms can be a whole lecture hall (the server enforces the same number). */
export const MAX_GROUP_MEMBERS = 200;

/** What the "join this room?" prompt shows for an invite code. */
export interface InvitePreview {
  name: string;
  description: string | null;
  location_tag: string | null;
  member_count: number;
  already_member: boolean;
  group_id: string | null;
}

export interface GroupSummary {
  group: Group;
  last: GroupMessage | null;
}

/**
 * Private groups, their members and messages, with Realtime. Mounted once at the app root.
 * `activeGroupId` is the chat currently on screen — no alert for messages in it.
 */
export function useGroups(userId: string | null, activeGroupId: string | null) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [polls, setPolls] = useState<Record<string, GroupPoll>>({});
  const [votes, setVotes] = useState<Record<string, Record<string, string>>>({}); // poll → person → option
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;
  const pollsRef = useRef(polls);
  pollsRef.current = polls;
  const votesRef = useRef(votes);
  votesRef.current = votes;
  const [reads, setReads] = useState<ReadMap>(() => loadReads(GROUP_READ_KEY));
  const readsRef = useRef(reads);
  readsRef.current = reads;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    saveReads(GROUP_READ_KEY, reads);
  }, [reads]);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const membersRef = useRef(members);
  membersRef.current = members;
  const activeRef = useRef(activeGroupId);
  activeRef.current = activeGroupId;
  const createdByMe = useRef(new Set<string>());

  const loadMembers = useCallback(async (groupId: string) => {
    const { data, error } = await supabase.rpc('get_group_members', { grp: groupId });
    if (error) return;
    setMembers((prev) => ({ ...prev, [groupId]: (data ?? []) as GroupMember[] }));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const [g, m, mine, rx, pl, vt] = await Promise.all([
      supabase.from('groups').select('*').order('created_at', { ascending: false }),
      supabase.from('group_messages').select('*').order('created_at', { ascending: true }).limit(2000),
      supabase.from('group_members').select('group_id,last_read_at').eq('user_id', userId),
      supabase.from('message_reactions').select('*').not('group_message_id', 'is', null).not('emoji', 'is', null),
      supabase.from('group_polls').select('*, group_poll_options(*)'),
      supabase.from('group_poll_votes').select('*'),
    ]);
    if (g.error) return; // e.g. migration not applied yet — groups simply stay empty
    const gs = (g.data ?? []) as Group[];
    const msgs = (m.data ?? []) as GroupMessage[];
    setGroups(gs);
    setMessages(msgs);
    if (!rx.error && rx.data) {
      let map: ReactionMap = {};
      for (const x of rx.data as Reaction[]) if (x.group_message_id) map = withReaction(map, groupKey(x.group_message_id), x.user_id, x.emoji);
      setReactions(map);
    }
    if (!pl.error && pl.data) setPolls(Object.fromEntries((pl.data as PollRow[]).map((r) => [r.id, toPoll(r)])));
    if (!vt.error && vt.data) {
      const byPoll: Record<string, Record<string, string>> = {};
      for (const x of vt.data as { poll_id: string; user_id: string; option_id: string }[]) (byPoll[x.poll_id] ??= {})[x.user_id] = x.option_id;
      setVotes(byPoll);
    }
    const fromServer = mine.error
      ? []
      : (mine.data as { group_id: string; last_read_at: string | null }[])
          .filter((x) => x.last_read_at)
          .map((x): [string, string] => [x.group_id, x.last_read_at as string]);
    setReads((prev) => {
      const merged = mergeReads(prev, fromServer);
      // No read time anywhere for a group (column missing + fresh device): start from "everything so far is read",
      // instead of flooding the badge with the whole history.
      const seed: [string, string][] = gs
        .filter((x) => !merged[x.id])
        .map((x) => [x.id, [...msgs].reverse().find((y) => y.group_id === x.id)?.created_at ?? x.created_at]);
      return mergeReads(merged, seed);
    });
    await Promise.all(gs.map((x) => loadMembers(x.id)));
  }, [userId, loadMembers]);

  /** One poll with its options and votes: used when a poll message arrives (or was just created) before the list knows it. */
  const loadPoll = useCallback(async (pollId: string) => {
    const [p, v] = await Promise.all([
      supabase.from('group_polls').select('*, group_poll_options(*)').eq('id', pollId).maybeSingle(),
      supabase.from('group_poll_votes').select('*').eq('poll_id', pollId),
    ]);
    if (p.data) setPolls((prev) => ({ ...prev, [pollId]: toPoll(p.data as PollRow) }));
    if (v.data) {
      const byUser: Record<string, string> = {};
      for (const x of v.data as { user_id: string; option_id: string }[]) byUser[x.user_id] = x.option_id;
      setVotes((prev) => ({ ...prev, [pollId]: byUser }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime may drop while the phone sleeps, and leaves are not pushed → reload on foreground.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    const onMemberChange = async (payload: { eventType: string; new: unknown }) => {
      const row = payload.new as Partial<{ group_id: string; user_id: string; share_socials: boolean }>;
      if (!row.group_id) return;
      if (payload.eventType === 'UPDATE') {
        // members bump last_read_at all the time; only reload when something visible (sharing) changed
        const known = membersRef.current[row.group_id]?.find((x) => x.member_id === row.user_id);
        if (known && known.share_socials === row.share_socials) return;
      }
      if (payload.eventType === 'INSERT' && row.user_id === userId) {
        const known = groupsRef.current.some((g) => g.id === row.group_id);
        await load();
        if (!known && !createdByMe.current.has(row.group_id)) {
          const name = groupsRef.current.find((g) => g.id === row.group_id)?.name;
          void alertIncoming('קבוצה חדשה', name ? `הוספו אותך ל"${name}"` : 'הוספו אותך לקבוצה', `grp-${row.group_id}`);
        }
      } else {
        void loadMembers(row.group_id);
      }
    };

    const onReaction = (row: Reaction) => {
      if (!row.group_message_id) return; // direct-message reactions are handled by useInbox
      setReactions((prev) => withReaction(prev, groupKey(row.group_message_id as string), row.user_id, row.emoji));
    };
    const onVote = (row: { poll_id: string; user_id: string; option_id: string }) =>
      setVotes((prev) => ({ ...prev, [row.poll_id]: { ...prev[row.poll_id], [row.user_id]: row.option_id } }));

    const channel = supabase
      .channel(`groups:${userId}`)
      // INSERT/UPDATE only: Realtime does not apply RLS to DELETE events, so leaves are picked up on open/refocus instead.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members' }, (p) => void onMemberChange(p))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_members' }, (p) => void onMemberChange(p))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const msg = payload.new as GroupMessage;
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
        if (msg.kind === 'poll' && msg.poll_id && !pollsRef.current[msg.poll_id]) void loadPoll(msg.poll_id);
        if (msg.sender_id === userId) return;
        if (activeRef.current === msg.group_id && document.visibilityState === 'visible') return; // already reading it
        const g = groupsRef.current.find((x) => x.id === msg.group_id);
        const who = membersRef.current[msg.group_id]?.find((x) => x.member_id === msg.sender_id)?.first_name ?? 'מישהו';
        void alertIncoming(g?.name ?? 'קבוצה', `${who}: ${messagePreview(msg).slice(0, 80)}`, `gmsg-${msg.group_id}`);
      })
      // pin / unpin by the creator
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups' }, (p) => {
        const row = p.new as Group;
        setGroups((prev) => prev.map((g) => (g.id === row.id ? { ...g, ...row } : g)));
      })
      // reactions and votes: INSERT / UPDATE only (DELETE events are not filtered by RLS; removal is an UPDATE to NULL)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (p) => onReaction(p.new as Reaction))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions' }, (p) => onReaction(p.new as Reaction))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_poll_votes' }, (p) => onVote(p.new as { poll_id: string; user_id: string; option_id: string }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_poll_votes' }, (p) => onVote(p.new as { poll_id: string; user_id: string; option_id: string }))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load, loadMembers, loadPoll]);

  const create = useCallback(
    async (
      name: string,
      memberIds: string[],
      extras?: { description?: string; location?: string },
    ): Promise<Result & { id?: string; extrasDropped?: boolean }> => {
      const base = { group_name: name.trim(), member_ids: memberIds };
      const description = extras?.description?.trim() ?? '';
      const location = extras?.location?.trim() ?? '';
      const hasExtras = !!(description || location);
      let res = hasExtras
        ? await supabase.rpc('create_group', { ...base, group_description: description || null, group_location: location || null })
        : await supabase.rpc('create_group', base);
      let extrasDropped = false;
      if (res.error && hasExtras && isMissingFunction(res.error)) {
        // rooms_invites.sql not applied yet: still create the group, without description / place
        extrasDropped = true;
        res = await supabase.rpc('create_group', base);
      }
      if (res.error) return { error: res.error.message };
      const g = res.data as Group;
      createdByMe.current.add(g.id);
      setGroups((prev) => [g, ...prev.filter((x) => x.id !== g.id)]);
      await loadMembers(g.id);
      return { error: null, id: g.id, extrasDropped };
    },
    [loadMembers],
  );

  /** What an invite code leads to (name, place, head-count), without joining. null = not valid. */
  const previewInvite = useCallback(async (code: string): Promise<InvitePreview | null> => {
    const { data, error } = await supabase.rpc('preview_group_invite', { code });
    if (error) {
      console.warn('preview_group_invite failed', error.message);
      return null;
    }
    return ((Array.isArray(data) ? data[0] : data) as InvitePreview | undefined) ?? null;
  }, []);

  /** Join through an invite code (QR or link). Resolves once the room is loaded, ready to open. */
  const joinByCode = useCallback(
    async (code: string): Promise<Result & { id?: string }> => {
      const { data, error } = await supabase.rpc('join_group_by_code', { code });
      if (error) return { error: error.message };
      const g = data as Group;
      createdByMe.current.add(g.id); // no "someone added you" alert for a room I walked into myself
      await load();
      return { error: null, id: g.id };
    },
    [load],
  );

  /** Any member can add connections / people nearby (server enforces eligibility and the 30 cap). */
  const addMembers = useCallback(
    async (groupId: string, memberIds: string[]): Promise<Result> => {
      const { error } = await supabase.rpc('add_group_members', { grp: groupId, member_ids: memberIds });
      if (error) return { error: error.message };
      await loadMembers(groupId);
      return { error: null };
    },
    [loadMembers],
  );

  /** "עזוב קבוצה" — drops the group and its messages from this device once the server confirms. */
  const leave = useCallback(async (groupId: string): Promise<Result> => {
    const { error } = await supabase.rpc('leave_group', { grp: groupId });
    if (error) return { error: error.message };
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMessages((prev) => prev.filter((m) => m.group_id !== groupId));
    setMembers((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    return { error: null };
  }, []);

  const sendMessage = useCallback(async (groupId: string, content: string): Promise<Result> => {
    const text = content.trim().slice(0, 1000);
    if (!text) return { error: 'empty' };
    const { data, error } = await supabase.rpc('send_group_message', { grp: groupId, body: text });
    if (error) return { error: error.message };
    const msg = data as GroupMessage;
    setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
    return { error: null };
  }, []);

  /** "שתף LinkedIn/IG בקבוצה" — the member's own flag, applied optimistically. */
  const setShare = useCallback(
    async (groupId: string, share: boolean): Promise<Result> => {
      if (!userId) return { error: 'not signed in' };
      const patch = (on: boolean) =>
        setMembers((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((m) => (m.member_id === userId ? { ...m, share_socials: on } : m)),
        }));
      patch(share);
      const { error } = await supabase
        .from('group_members')
        .update({ share_socials: share })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) {
        patch(!share);
        toast('לא הצלחנו לעדכן את השיתוף', 'error');
        return { error: error.message };
      }
      void loadMembers(groupId); // pick up my own links now that they are (un)shared
      return { error: null };
    },
    [userId, loadMembers],
  );

  /**
   * Mark a group read: now, and in Supabase (group_members.last_read_at).
   * No-op when there is nothing newer than what was already seen.
   */
  const markRead = useCallback(
    (groupId: string) => {
      const incoming = messagesRef.current.filter((m) => m.group_id === groupId && m.sender_id !== userId);
      const newest = incoming[incoming.length - 1]?.created_at;
      if (!newest || !isLater(newest, readsRef.current[groupId])) return;
      setReads((prev) => mergeReads(prev, [[groupId, newest]])); // the message's own (server) timestamp
      void supabase.rpc('mark_group_read', { grp: groupId }).then(({ data, error }) => {
        if (error) console.warn('mark_group_read failed', error.message);
        else if (typeof data === 'string') setReads((prev) => mergeReads(prev, [[groupId, data]]));
      });
    },
    [userId],
  );

  /** Messages from other people newer than my last_read_at, per group. */
  const unread = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of messages) {
      if (m.sender_id !== userId && isLater(m.created_at, reads[m.group_id])) out[m.group_id] = (out[m.group_id] ?? 0) + 1;
    }
    return out;
  }, [messages, reads, userId]);

  /** "שתף את ה-LinkedIn שלי בחדר": share my link in this room and post a LinkedIn card (older servers: just the share flag). */
  const shareLinkedIn = useCallback(
    async (groupId: string): Promise<Result> => {
      const { data, error } = await supabase.rpc('share_linkedin_in_group', { grp: groupId });
      if (error) {
        if (isMissingFunction(error)) return setShare(groupId, true);
        return { error: error.message };
      }
      const msg = data as GroupMessage;
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((m) => (m.member_id === userId ? { ...m, share_socials: true } : m)),
      }));
      void loadMembers(groupId); // my link is now part of the room's member list
      return { error: null };
    },
    [userId, loadMembers, setShare],
  );

  /** Instagram has its own switch inside a room. */
  const setShareInstagram = useCallback(
    async (groupId: string, share: boolean): Promise<Result> => {
      if (!userId) return { error: 'not signed in' };
      const patch = (on: boolean) =>
        setMembers((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((m) => (m.member_id === userId ? { ...m, share_instagram: on } : m)),
        }));
      patch(share);
      const { error } = await supabase.from('group_members').update({ share_instagram: share }).eq('group_id', groupId).eq('user_id', userId);
      if (error) {
        patch(!share);
        toast('לא הצלחנו לעדכן את שיתוף ה-Instagram', 'error');
        return { error: error.message };
      }
      void loadMembers(groupId);
      return { error: null };
    },
    [userId, loadMembers],
  );

  /** React to a room message with one of the quick emojis (same emoji again removes it). Optimistic, rolled back on error. */
  const react = useCallback(
    async (messageId: string, emoji: string): Promise<Result> => {
      if (!userId) return { error: 'not signed in' };
      const key = groupKey(messageId);
      const before = reactionsRef.current[key]?.[userId] ?? null;
      setReactions((prev) => withReaction(prev, key, userId, toggledReaction(prev, key, userId, emoji)));
      const { data, error } = await supabase.rpc('react_to_message', { p_group_message: messageId, p_emoji: emoji });
      if (error) {
        setReactions((prev) => withReaction(prev, key, userId, before));
        return { error: error.message };
      }
      setReactions((prev) => withReaction(prev, key, userId, typeof data === 'string' ? data : null));
      return { error: null };
    },
    [userId],
  );

  /** "סקר מהיר": a question (≤80) and 2-4 options (≤40 each), posted into the room. */
  const createPoll = useCallback(
    async (groupId: string, question: string, options: string[]): Promise<Result> => {
      const { data, error } = await supabase.rpc('create_group_poll', { grp: groupId, poll_question: question, poll_options: options });
      if (error) return { error: error.message };
      const msg = data as GroupMessage;
      if (msg.poll_id) await loadPoll(msg.poll_id);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      return { error: null };
    },
    [loadPoll],
  );

  /** One tap votes, another option changes the vote. */
  const votePoll = useCallback(
    async (pollId: string, optionId: string): Promise<Result> => {
      if (!userId) return { error: 'not signed in' };
      const before = votesRef.current[pollId]?.[userId];
      const put = (option: string | undefined) =>
        setVotes((prev) => {
          const users = { ...(prev[pollId] ?? {}) };
          if (option) users[userId] = option;
          else delete users[userId];
          return { ...prev, [pollId]: users };
        });
      put(optionId);
      const { error } = await supabase.rpc('vote_group_poll', { p_poll: pollId, p_option: optionId });
      if (error) {
        put(before);
        toast('ההצבעה לא נקלטה. נסו שוב.', 'error');
        return { error: error.message };
      }
      return { error: null };
    },
    [userId],
  );

  /** Creator only: pin a message (one per room), or pass null to remove the pin. */
  const pinMessage = useCallback(async (groupId: string, messageId: string | null): Promise<Result> => {
    const before = groupsRef.current.find((g) => g.id === groupId)?.pinned_message_id ?? null;
    const put = (id: string | null) => setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, pinned_message_id: id } : g)));
    put(messageId);
    const { error } = await supabase.rpc('pin_group_message', { grp: groupId, msg: messageId });
    if (error) {
      put(before);
      toast('לא הצלחנו לעדכן את הנעיצה', 'error');
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const summaries = useMemo<GroupSummary[]>(
    () =>
      groups
        .map((group) => {
          const msgs = messages.filter((m) => m.group_id === group.id);
          return { group, last: msgs[msgs.length - 1] ?? null };
        })
        .sort((a, b) => (b.last?.created_at ?? b.group.created_at).localeCompare(a.last?.created_at ?? a.group.created_at)),
    [groups, messages],
  );

  return {
    groups,
    summaries,
    members,
    messages,
    unread,
    markRead,
    create,
    previewInvite,
    joinByCode,
    addMembers,
    leave,
    sendMessage,
    setShare,
    shareLinkedIn,
    setShareInstagram,
    reactions,
    react,
    polls,
    votes,
    createPoll,
    votePoll,
    pinMessage,
    refresh: load,
    refreshMembers: loadMembers,
  };
}

export type GroupsData = ReturnType<typeof useGroups>;
