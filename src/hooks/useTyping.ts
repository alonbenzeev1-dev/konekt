import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const SHOW_MS = 4_000; // a typing signal is believed for this long
const SEND_EVERY_MS = 2_500; // at most one signal per this while someone types

/**
 * "מקליד..." over Supabase Realtime Broadcast: ephemeral, nothing is written to the database.
 * One channel per conversation; `notify()` on every keystroke is throttled; `clear(id)` when their message arrives.
 */
export function useTyping(topic: string | null, myId: string) {
  const [until, setUntil] = useState<Record<string, number>>({});
  const channel = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!topic) return;
    ready.current = false;
    const ch = supabase.channel(`typing:${topic}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const id = (payload as { u?: string } | null)?.u;
      if (typeof id === 'string' && id !== myId) setUntil((p) => ({ ...p, [id]: Date.now() + SHOW_MS }));
    }).subscribe((status) => {
      ready.current = status === 'SUBSCRIBED';
    });
    channel.current = ch;
    return () => {
      ready.current = false;
      channel.current = null;
      setUntil({});
      void supabase.removeChannel(ch);
    };
  }, [topic, myId]);

  // expire stale signals
  useEffect(() => {
    const ids = Object.keys(until);
    if (ids.length === 0) return;
    const next = Math.min(...ids.map((id) => until[id])) - Date.now();
    const t = setTimeout(() => setUntil((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v > Date.now()))), Math.max(next, 50));
    return () => clearTimeout(t);
  }, [until]);

  const notify = useCallback(() => {
    const now = Date.now();
    if (!ready.current || now - lastSent.current < SEND_EVERY_MS) return;
    lastSent.current = now;
    void channel.current?.send({ type: 'broadcast', event: 'typing', payload: { u: myId } });
  }, [myId]);

  const clear = useCallback((id: string) => {
    setUntil((p) => {
      if (!(id in p)) return p;
      const { [id]: _drop, ...rest } = p;
      return rest;
    });
  }, []);

  return { typers: Object.keys(until), notify, clear };
}
