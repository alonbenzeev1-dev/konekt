import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { alertIncoming } from '../lib/notify';
import { kindLabel } from '../lib/social';
import type { Chat, ConnectionRequest, Message, PublicProfile, RequestKind } from '../lib/types';

export interface ChatThread {
  chat: Chat;
  partnerId: string;
  last: Message | null;
  unread: number;
}

const READ_KEY = 'konekt-read';

function loadRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '{}');
  } catch {
    return {};
  }
}

type Result = { error: string | null };

/**
 * Single source of truth for requests, chats and messages, with Realtime.
 * Mounted once at the app root so alerts fire on every tab.
 */
export function useInbox(userId: string | null) {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [readAt, setReadAt] = useState<Record<string, string>>(loadRead);
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const partnerOf = useCallback((c: Chat) => (c.user_a === userId ? c.user_b : c.user_a), [userId]);

  const loadPeople = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !peopleRef.current[id]);
    if (!missing.length) return;
    const { data } = await supabase.rpc('get_public_profiles', { ids: missing });
    if (data?.length) {
      setPeople((prev) => {
        const next = { ...prev };
        for (const p of data as PublicProfile[]) next[p.id] = p;
        return next;
      });
    }
  }, []);

  const load = useCallback(async (): Promise<Chat[]> => {
    if (!userId) return [];
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const [r, c, m] = await Promise.all([
      supabase.from('connection_requests').select('*').gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('chats').select('*'),
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(2000),
    ]);
    const reqs = (r.data ?? []) as ConnectionRequest[];
    const chs = (c.data ?? []) as Chat[];
    setRequests(reqs);
    setChats(chs);
    setMessages((m.data ?? []) as Message[]);
    void loadPeople([
      ...reqs.map((x) => (x.sender_id === userId ? x.receiver_id : x.sender_id)),
      ...chs.map((x) => (x.user_a === userId ? x.user_b : x.user_a)),
    ]);
    return chs;
  }, [userId, loadPeople]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime may drop while the phone sleeps → reload on foreground.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const nameOf = async (id: string) => {
      await loadPeople([id]);
      return peopleRef.current[id]?.first_name ?? 'מישהו';
    };

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
          const name = await nameOf(msg.sender_id);
          void alertIncoming(`הודעה מ${name}`, msg.content.slice(0, 80), `msg-${msg.chat_id}`);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'connection_requests', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const req = payload.new as ConnectionRequest;
          setRequests((prev) => [req, ...prev.filter((x) => x.id !== req.id)]);
          const name = await nameOf(req.sender_id);
          const body = req.kind === 'chat' ? `${name} רוצה להתחיל צ׳אט` : `${name} מבקש/ת את ה-${kindLabel[req.kind]} שלך`;
          void alertIncoming('בקשה חדשה', body, `req-${req.id}`);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'connection_requests', filter: `sender_id=eq.${userId}` },
        async (payload) => {
          const req = payload.new as ConnectionRequest;
          setRequests((prev) => prev.map((x) => (x.id === req.id ? req : x)));
          if (req.status === 'accepted') {
            if (req.kind === 'chat') void load(); // a chat was opened for us
            const name = await nameOf(req.receiver_id);
            const body = req.kind === 'chat' ? `${name} אישר/ה — הצ׳אט פתוח ל-24 שעות` : `${name} אישר/ה את בקשת ה-${kindLabel[req.kind]}`;
            void alertIncoming('הבקשה אושרה!', body, `acc-${req.id}`);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadPeople, load]);

  const sendRequest = useCallback(
    async (to: string, kind: RequestKind, firstMessage?: string): Promise<Result> => {
      const { data, error } = await supabase.rpc('send_request', {
        target: to,
        req_kind: kind,
        first_message: kind === 'chat' ? firstMessage ?? '' : null,
      });
      if (error) return { error: error.message };
      const req = data as ConnectionRequest;
      setRequests((prev) => [req, ...prev.filter((x) => x.id !== req.id)]);
      void loadPeople([to]);
      return { error: null };
    },
    [loadPeople],
  );

  /** Approve ("אשר"). For a chat request, returns the id of the chat it opened. */
  const respond = useCallback(
    async (requestId: string): Promise<Result & { chatId?: string }> => {
      const { data, error } = await supabase.rpc('respond_request', { request_id: requestId, accept: true });
      if (error) return { error: error.message };
      const req = data as ConnectionRequest;
      setRequests((prev) => prev.map((x) => (x.id === req.id ? req : x)));
      if (req.kind !== 'chat') return { error: null };
      const chs = await load();
      const chat = chs.find((c) => c.user_a === req.sender_id || c.user_b === req.sender_id);
      return { error: null, chatId: chat?.id };
    },
    [load],
  );

  /** "התעלם / חסום" — mutual, permanent, silent. */
  const block = useCallback(
    async (otherId: string): Promise<Result> => {
      const { error } = await supabase.rpc('block_user', { target: otherId });
      if (error) return { error: error.message };
      setRequests((prev) => prev.filter((x) => x.sender_id !== otherId && x.receiver_id !== otherId));
      setChats((prev) => prev.filter((c) => partnerOf(c) !== otherId));
      setMessages((prev) => prev.filter((m) => m.sender_id !== otherId && m.receiver_id !== otherId));
      return { error: null };
    },
    [partnerOf],
  );

  const sendMessage = useCallback(async (chatId: string, content: string): Promise<Result> => {
    const text = content.trim().slice(0, 1000);
    if (!text) return { error: 'empty' };
    const { data, error } = await supabase.rpc('send_message', { chat: chatId, body: text });
    if (error) return { error: error.message };
    setMessages((prev) => [...prev, data as Message]);
    return { error: null };
  }, []);

  const markRead = useCallback((chatId: string) => {
    setReadAt((prev) => {
      const next = { ...prev, [chatId]: new Date().toISOString() };
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const threads = useMemo<ChatThread[]>(() => {
    if (!userId) return [];
    return chats
      .map((chat) => {
        const msgs = messages.filter((m) => m.chat_id === chat.id);
        const last = msgs[msgs.length - 1] ?? null;
        const seen = readAt[chat.id];
        const unread = msgs.filter((m) => m.sender_id !== userId && (!seen || m.created_at > seen)).length;
        return { chat, partnerId: partnerOf(chat), last, unread };
      })
      .sort((a, b) => (b.last?.created_at ?? b.chat.created_at).localeCompare(a.last?.created_at ?? a.chat.created_at));
  }, [chats, messages, readAt, userId, partnerOf]);

  return { requests, chats, messages, threads, people, sendRequest, respond, block, sendMessage, markRead, reload: load };
}

export type Inbox = ReturnType<typeof useInbox>;
