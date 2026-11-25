import type { ReactionPill } from '../lib/reactions';

/**
 * Compact reactions under a bubble: emoji + count, mine highlighted. Tapping a pill toggles my reaction with it.
 * The pill is 32px tall; the hit area is stretched to about 48px so it is easy to hit with a thumb.
 */
export function ReactionPills({ pills, onToggle, mine }: { pills: ReactionPill[]; onToggle: (emoji: string) => void; mine: boolean }) {
  if (!pills.length) return null;
  return (
    <div className={`-mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`} role="group" aria-label="תגובות">
      {pills.map((p) => (
        <button
          key={p.emoji}
          type="button"
          aria-pressed={p.mine}
          aria-label={`${p.emoji} ${p.count}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(p.emoji);
          }}
          className={`relative inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] transition-colors before:absolute before:-inset-y-2 before:-inset-x-0.5 before:content-[''] ${
            p.mine ? 'border-primary bg-primary-soft font-bold text-cta-press' : 'border-line bg-card text-ink'
          }`}
        >
          <span className="text-base leading-none">{p.emoji}</span>
          <span dir="ltr" className="tabular-nums">{p.count}</span>
        </button>
      ))}
    </div>
  );
}
