import { Pin, X } from 'lucide-react';

/** The room's pinned message, right under the header. Tap: scroll to it. A link inside it gets its own "open" button. */
export function PinnedBar({ preview, url, canUnpin, onJump, onUnpin }: { preview: string; url: string | null; canUnpin: boolean; onJump: () => void; onUnpin: () => void }) {
  return (
    <div className="flex items-stretch border-b border-line bg-card" role="region" aria-label="הודעה נעוצה">
      <button onClick={onJump} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-start active:bg-bg">
        <Pin size={15} className="shrink-0 text-cta" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] leading-tight font-bold text-cta-press">הודעה נעוצה</span>
          <span dir="auto" className="block truncate text-right text-[13px] leading-snug text-ink/80">{preview}</span>
        </span>
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] shrink-0 items-center px-3 text-xs font-bold text-cta-press active:bg-bg">
          פתח קישור ↗
        </a>
      )}
      {canUnpin && (
        <button onClick={onUnpin} aria-label="הסרת נעיצה" className="flex w-11 shrink-0 items-center justify-center text-muted active:bg-bg">
          <X size={17} />
        </button>
      )}
    </div>
  );
}
