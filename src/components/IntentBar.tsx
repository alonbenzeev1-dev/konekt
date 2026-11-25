import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { TypewriterInput } from './TypewriterInput';
import { INTENT_TTL_MS } from '../lib/intent';

const HOURS = Math.round(INTENT_TTL_MS / 3600_000);

/**
 * "מה הקטע שלך כרגע?": set or clear the live status in a couple of seconds. The profile updates at once
 * (optimistic); if the server refuses, the parent rolls it back and what was typed stays in the field.
 */
export function IntentBar({ saved, onSave }: { saved: string | null; onSave: (v: string | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState(saved ?? '');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const keep = useRef<string | null>(null); // typed text to put back after a rollback
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // follow the saved value (changed from another screen, or rolled back), but never drop what was just typed
  useEffect(() => {
    if (keep.current !== null) {
      setDraft(keep.current);
      keep.current = null;
    } else {
      setDraft(saved ?? '');
    }
  }, [saved]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const trimmed = draft.trim();
  const dirty = trimmed !== (saved ?? '');

  const commit = async (value: string | null) => {
    if (busy) return;
    setBusy(true);
    const ok = await onSave(value);
    setBusy(false);
    if (!ok) {
      keep.current = draft;
      return;
    }
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 2200);
  };

  return (
    <section aria-label="סטטוס נוכחי" className="card mb-4 rounded-2xl p-3.5">
      <label htmlFor="intent-input" className="mb-2 block text-sm font-bold text-ink">
        מה הקטע שלך כרגע?
      </label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TypewriterInput id="intent-input" value={draft} onChange={setDraft} onSubmit={() => dirty && void commit(trimmed || null)} />
        </div>
        {dirty ? (
          <button
            onClick={() => void commit(trimmed || null)}
            disabled={busy}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-cta px-4 text-sm font-bold text-white active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            {trimmed ? 'שמור' : 'נקה'}
          </button>
        ) : saved ? (
          <button
            onClick={() => void commit(null)}
            disabled={busy}
            aria-label="נקה סטטוס"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted active:bg-bg disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={18} />}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted" aria-live="polite">
        {flash ? (
          <span className="font-bold text-live">✓ נשמר. מי שלידך רואה את זה בכרטיס שלך</span>
        ) : (
          `מופיע בכרטיס שלך אצל מי שלידך, ונעלם אחרי ${HOURS} שעות`
        )}
      </p>
    </section>
  );
}
