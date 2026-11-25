import { useState } from 'react';
import { EMOJI_CATEGORIES } from '../lib/chatEmoji';

/**
 * A small panel above the composer: four categories, a plain grid, no library.
 * Buttons swallow mousedown so the text field keeps focus (and the phone keeps its keyboard) while you pick.
 */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const current = EMOJI_CATEGORIES.find((c) => c.id === cat) ?? EMOJI_CATEGORIES[0];
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="border-t border-line bg-card px-3 pt-1.5 pb-1" role="group" aria-label="בחירת אימוג׳י">
      <div role="tablist" aria-label="קטגוריות" className="flex items-center gap-1">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === cat}
            aria-label={c.label}
            onMouseDown={keepFocus}
            onClick={() => setCat(c.id)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-colors ${c.id === cat ? 'bg-primary-soft' : 'active:bg-bg'}`}
          >
            {c.icon}
          </button>
        ))}
        <span className="ms-2 text-xs font-bold text-muted">{current.label}</span>
      </div>
      <div className="grid max-h-[176px] grid-cols-7 overflow-y-auto overscroll-contain">
        {current.emojis.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={e}
            onMouseDown={keepFocus}
            onClick={() => onPick(e)}
            className="flex h-11 items-center justify-center rounded-xl text-2xl active:bg-bg"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Put `emoji` where the caret is (or replace the selection), keep focus, and put the caret right after it. */
export function insertAtCursor(field: HTMLTextAreaElement | null, value: string, emoji: string, max: number): { next: string; caret: number } {
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? value.length;
  const next = (value.slice(0, start) + emoji + value.slice(end)).slice(0, max);
  return { next, caret: Math.min(start + emoji.length, next.length) };
}
