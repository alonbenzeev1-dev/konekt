import { BarChart3, Check, Loader2 } from 'lucide-react';
import type { GroupPoll } from '../lib/types';

/**
 * A quick poll inside the room: live counts, a progress bar per option (scaleX, so it animates on the GPU),
 * one tap votes, another option changes the vote.
 */
export function PollCard({
  poll,
  votes,
  myId,
  onVote,
  by,
}: {
  poll: GroupPoll | undefined;
  /** person → option */
  votes: Record<string, string> | undefined;
  myId: string;
  onVote: (optionId: string) => void;
  by: string;
}) {
  if (!poll) {
    return (
      <div className="flex w-[86%] max-w-[320px] items-center gap-2 rounded-2xl border border-line bg-card p-3 text-xs text-muted shadow-sm">
        <Loader2 size={14} className="animate-spin" /> טוען סקר…
      </div>
    );
  }
  const all = Object.values(votes ?? {});
  const total = all.length;
  const mine = votes?.[myId];
  const count = (id: string) => all.filter((v) => v === id).length;

  return (
    <div className="w-[86%] max-w-[320px] rounded-2xl border border-line bg-card p-3 shadow-sm">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-cta-press">
        <BarChart3 size={13} /> סקר מהיר · {by}
      </p>
      <p dir="auto" className="mb-3 text-right text-[15px] leading-snug font-bold text-ink">{poll.question}</p>
      <ul className="space-y-1.5">
        {poll.options.map((o) => {
          const n = count(o.id);
          const pct = total ? Math.round((n * 100) / total) : 0;
          const chosen = mine === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(o.id);
                }}
                className={`relative flex min-h-[44px] w-full items-center gap-2 overflow-hidden rounded-xl border px-3 text-start transition-colors ${chosen ? 'border-primary' : 'border-line'}`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-0 origin-right transition-transform duration-300 ease-out ${chosen ? 'bg-primary/25' : 'bg-primary-soft'}`}
                  style={{ transform: `scaleX(${pct / 100})` }}
                />
                <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
                  {chosen && <Check size={15} strokeWidth={3} className="shrink-0 text-cta" />}
                  <span dir="auto" className="truncate text-sm font-medium text-ink">{o.label}</span>
                </span>
                <span dir="ltr" className="relative z-10 shrink-0 text-xs font-bold text-ink/70 tabular-nums">
                  {pct}% · {n}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        <span className="tabular-nums">{total}</span> הצבעות · לחצו כדי להצביע או לשנות
      </p>
    </div>
  );
}
