import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertIncoming, toast } from '../lib/notify';
import { isLater, loadReads, mergeReads, saveReads, type ReadMap } from '../lib/reads';
import type { Group, GroupMember, GroupMessage } from '../lib/types';

/** Local mirror of group_members.last_read_at: fallback while offline / before the read_state migration. */
const GROUP_READ_KEY = 'konekt-group-read';

type Result = { error: string | null };

export const MAX_GROUP_MEMBERS = 30;

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
    const [g, m, mine] = await Promise.all([
      supabase.from('groups').select('*').order('created_at', { ascending: false }),
      supabase.from('group_messages').select('*').order('created_at', { ascending: true }).limit(2000),
      supabase.from('group_members').select('group_id,last_read_at').eq('user_id', userId),
    ]);
    if (g.error) return; // e.g. migration not applied yet — groups simply stay empty
    const gs = (g.data ?? []) as Group[];
    const msgs = (m.data ?? []) as GroupMessage[];
    setGroups(gs);
    setMessages(msgs);
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

    const channel = supabase
      .channel(`groups:${userId}`)
      // INSERT/UPDATE only: Realtime does not apply RLS to DELETE events, so leaves are picked up on open/refocus instead.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members' }, (p) => void onMemberChange(p))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_members' }, (p) => void onMemberChange(p))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const msg = payload.new as GroupMessage;
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
        if (msg.sender_id === userId) return;
        if (activeRef.current === msg.group_id && document.visibilityState === 'visible') return; // already reading it
        const g = groupsRef.current.find((x) => x.id === msg.group_id);
        const who = membersRef.current[msg.group_id]?.find((x) => x.member_id === msg.sender_id)?.first_name ?? 'מישהו';
        void alertIncoming(g?.name ?? 'קבוצה', `${who}: ${msg.content.slice(0, 80)}`, `gmsg-${msg.group_id}`);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load, loadMembers]);

  const create = useCallback(
    async (name: string, memberIds: string[]): Promise<Result & { id?: string }> => {
      const { data, error } = await supabase.rpc('create_group', { group_name: name.trim(), member_ids: memberIds });
      if (error) return { error: error.message };
      const g = data as Group;
      createdByMe.current.add(g.id);
      setGroups((prev) => [g, ...prev.filter((x) => x.id !== g.id)]);
      await loadMembers(g.id);
      return { error: null, id: g.id };
    },
    [loadMembers],
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

  return { groups, summaries, members, messages, unread, markRead, create, addMembers, leave, sendMessage, setShare, refreshMembers: loadMembers };
}

export type GroupsData = ReturnType<typeof useGroups>;
