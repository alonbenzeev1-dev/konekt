import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { distanceMeters } from '../lib/geo';

export interface Coords { lat: number; lng: number; accuracy: number }
export type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable';

const MIN_MOVE_M = 8;          // write to DB if moved more than this…
const MIN_WRITE_MS = 20_000;   // …or this much time passed
const HEARTBEAT_MS = 60_000;   // keep last_seen_at fresh (radar presence expires after 10 min)

/**
 * GPS watcher + presence writer. Runs only while `visible` (גלוי בסביבה)
 * and the tab is visible — "discoverable whenever the app is open".
 */
export function usePresence(userId: string | null, visible: boolean) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === "visible");
  const lastWrite = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const latest = useRef<Coords | null>(null);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!userId || !visible || !pageVisible) return;
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus((s) => (s === 'ok' ? s : 'locating'));

    const write = async (c: Coords, force = false) => {
      const prev = lastWrite.current;
      const now = Date.now();
      if (
        !force && prev &&
        now - prev.at < MIN_WRITE_MS &&
        distanceMeters(prev.lat, prev.lng, c.lat, c.lng) < MIN_MOVE_M
      ) return;
      lastWrite.current = { lat: c.lat, lng: c.lng, at: now };
      const { error } = await supabase
        .from('profiles')
        .update({ lat: c.lat, lng: c.lng, last_seen_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) console.warn('presence write failed', error.message);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        latest.current = c;
        setCoords(c);
        setStatus('ok');
        void write(c);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    const beat = setInterval(() => {
      if (latest.current) void write(latest.current, true);
    }, HEARTBEAT_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(beat);
    };
  }, [userId, visible, pageVisible]);

  return { coords, status };
}
