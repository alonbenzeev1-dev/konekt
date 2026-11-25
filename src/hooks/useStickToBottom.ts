import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Chat scrolling that respects the reader:
 *  - opens at the bottom;
 *  - a new message scrolls into view only if you were already near the bottom (or you sent it);
 *  - if you are reading older messages it does NOT yank you down: `unseen` counts what arrived, `jump()` goes there.
 */
export function useStickToBottom(count: number, lastIsMine: boolean) {
  const mainRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const near = useRef(true);
  const first = useRef(true);
  const prev = useRef(count);
  const [unseen, setUnseen] = useState(0);

  const onScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    near.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (near.current) setUnseen(0);
  }, []);

  useEffect(() => {
    const added = count - prev.current;
    prev.current = count;
    if (first.current) {
      if (count > 0) first.current = false;
      endRef.current?.scrollIntoView({ block: 'end' }); // first paint: no animation
      return;
    }
    if (added <= 0) return;
    if (near.current || lastIsMine) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    else setUnseen((u) => u + added);
  }, [count, lastIsMine]);

  const jump = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnseen(0);
  }, []);

  return { mainRef, endRef, onScroll, unseen, jump };
}
