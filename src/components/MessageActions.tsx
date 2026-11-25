import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { QUICK_REACTIONS, sameEmoji } from '../lib/reactions';

/** Tap (or long-press) a message: six quick reactions, plus whatever else this chat offers (pin, …). */
export function MessageActions({
  open,
  onClose,
  preview,
  myReaction,
  onReact,
  children,
}: {
  open: boolean;
  onClose: () => void;
  preview: string;
  myReaction: string | null;
  onReact: (emoji: string) => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <p dir="auto" className="line-clamp-2 rounded-xl bg-bg px-3 py-2 text-right text-sm leading-snug text-ink/80">{preview}</p>
      <div className="mt-3 grid grid-cols-6 gap-1.5" role="group" aria-label="תגובה מהירה">
        {QUICK_REACTIONS.map((e) => {
          const on = sameEmoji(myReaction, e);
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              aria-label={`תגובה ${e}`}
              onClick={() => {
                onReact(e);
                onClose();
              }}
              className={`flex h-12 items-center justify-center rounded-xl border text-2xl transition-transform active:scale-95 ${on ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
            >
              {e}
            </button>
          );
        })}
      </div>
      {children && <div className="mt-3 space-y-2">{children}</div>}
    </BottomSheet>
  );
}
