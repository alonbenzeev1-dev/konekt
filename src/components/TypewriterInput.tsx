import { useEffect, useRef, useState } from 'react';
import { INTENT_MAX, INTENT_PHRASES } from '../lib/intent';

const TYPE_MS = 55; // per character typed
const DELETE_MS = 30; // per character removed
const HOLD_MS = 1800; // a finished phrase stays readable
const GAP_MS = 350; // empty beat before the next phrase
const START_MS = 500;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  ariaLabel?: string;
  phrases?: readonly string[];
  maxLength?: number;
  /** Enter key. */
  onSubmit?: () => void;
  className?: string;
}

/**
 * A text input whose placeholder types out example phrases, one after the other, while the field is empty and not
 * focused. The moment someone focuses or types, the hint is gone. With reduced motion it shows the first phrase,
 * still. 16px text (iOS Safari does not zoom on focus), RTL, a counter only near the limit.
 */
export function TypewriterInput({ value, onChange, id, ariaLabel, phrases = INTENT_PHRASES, maxLength = INTENT_MAX, onSubmit, className = '' }: Props) {
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState('');
  const reduced = usePrefersReducedMotion();
  const next = useRef(0); // which phrase comes next, kept across focus / blur
  const idle = !value && !focused;

  useEffect(() => {
    if (!idle) {
      setHint(''); // focus or typing: the animated hint disappears immediately
      return;
    }
    if (reduced) {
      setHint(phrases[0] ?? '');
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const phrase = () => phrases[next.current % phrases.length] ?? '';

    const erase = () => {
      n -= 1;
      setHint(phrase().slice(0, Math.max(n, 0)));
      if (n <= 0) {
        next.current += 1;
        timer = setTimeout(write, GAP_MS);
      } else {
        timer = setTimeout(erase, DELETE_MS);
      }
    };
    const write = () => {
      const full = phrase();
      n += 1;
      setHint(full.slice(0, n));
      timer = n >= full.length ? setTimeout(erase, HOLD_MS) : setTimeout(write, TYPE_MS);
    };

    timer = setTimeout(write, START_MS);
    return () => clearTimeout(timer);
  }, [idle, reduced, phrases]);

  const nearLimit = value.length >= maxLength - 12;
  return (
    <div className="min-w-0">
      <input
        id={id}
        type="text"
        enterKeyHint="done"
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        dir="rtl"
        aria-label={ariaLabel}
        placeholder={hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        className={`field text-right text-base ${className}`}
      />
      {nearLimit && (
        <p dir="ltr" className={`mt-1 text-end text-[11px] tabular-nums ${value.length >= maxLength ? 'font-bold text-danger' : 'text-muted'}`}>
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
