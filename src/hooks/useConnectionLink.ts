import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * loading     — asking the server
 * ready       — `link` is set
 * unavailable — the server answered, but there is no link to show (removed / blocked)
 * error       — the call itself failed; `retry` asks again
 */
export type LinkState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

interface Result {
  requestId: string;
  link: string | null;
  state: 'ready' | 'unavailable' | 'error';
}

/**
 * The profile URL revealed by an approved request I sent. Pass null until it is approved.
 * Fetched ahead of the tap so the UI can render a real <a> (popup blockers dislike window.open after await).
 * Goes through get_connection_link: RLS never lets one user read another's profile row.
 */
export function useConnectionLink(requestId: string | null) {
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setResult(null);
    supabase.rpc('get_connection_link', { request_id: requestId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.warn('connection link failed', error.message);
      const link = !error && typeof data === 'string' ? data : null;
      setResult({ requestId, link, state: error ? 'error' : link ? 'ready' : 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [requestId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Ignore a result that belongs to a previous request.
  const current = result && result.requestId === requestId ? result : null;
  const state: LinkState = !requestId ? 'idle' : current?.state ?? 'loading';
  return { link: current?.link ?? null, state, retry };
}
