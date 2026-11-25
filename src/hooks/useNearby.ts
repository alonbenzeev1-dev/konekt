import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { NearbyUser } from '../lib/types';
import type { Coords } from './usePresence';

const POLL_MS = 8_000;
export const RADIUS_M = 75;
export const CAMPUS_RADIUS_M = 1000;
/** Fewer than this many people nearby → show the campus count + invite. */
export const FEW_PEOPLE = 3;

export function useNearby(coords: Coords | null, visible: boolean) {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [campusCount, setCampusCount] = useState<number | null>(null);
  const [scanned, setScanned] = useState(false); // first result (or failure) is in: lets the UI show skeletons until then
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  const refresh = useCallback(async () => {
    const c = coordsRef.current;
    if (!c) return;
    const [nearby, campus] = await Promise.all([
      supabase.rpc('get_nearby_users', { user_lat: c.lat, user_lng: c.lng, radius_meters: RADIUS_M }),
      supabase.rpc('get_campus_count', { user_lat: c.lat, user_lng: c.lng }),
    ]);
    if (nearby.error) console.warn('nearby failed', nearby.error.message);
    else setUsers((nearby.data ?? []) as NearbyUser[]);
    if (!campus.error && typeof campus.data === 'number') setCampusCount(campus.data);
    setScanned(true);
  }, []);

  const hasCoords = coords !== null;
  const latKey = coords ? Math.round(coords.lat * 1e4) : 0;
  const lngKey = coords ? Math.round(coords.lng * 1e4) : 0;
  useEffect(() => {
    if (!visible || !hasCoords) return;
    const t = setTimeout(refresh, 600); // let the presence write land first
    return () => clearTimeout(t);
  }, [visible, hasCoords, latKey, lngKey, refresh]);

  useEffect(() => {
    if (!visible) {
      setUsers([]);
      setCampusCount(null);
      setScanned(false);
      return;
    }
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [visible, refresh]);

  return { users, campusCount, scanned, refresh };
}
