import { MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { TagChips } from './TagChips';

/** Friendly proximity next to the number (indoor GPS is fuzzy, so we never show more than "about"). */
export const proximityLabel = (m: number) => (m <= 30 ? 'ממש לידך' : 'באזור שלך');

export function DistancePill({ meters }: { meters: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] leading-none font-bold whitespace-nowrap text-cta-press">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {proximityLabel(meters)}
      <span aria-hidden className="opacity-40">·</span>
      <span dir="ltr" className="tabular-nums">~{meters} מ׳</span>
    </span>
  );
}

/** Shared by every full-width action under a student card. */
export const ctaBase = 'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-transform';

interface Props {
  name: string;
  headline?: string | null;
  /** Shown (muted, italic) when there is no headline: used by the profile preview. */
  headlineFallback?: string;
  avatarUrl: string | null;
  tags?: string[];
  /** Their live status ("מה הקטע שלך כרגע?"), when set. */
  intent?: string | null;
  distanceM: number;
  live?: boolean;
  /** Makes the identity block tappable (the CTA below is separate). */
  onOpen?: () => void;
  cta: ReactNode;
}

/**
 * One student, exactly as others see them in סביבי. The profile preview renders this same component,
 * so "how you look" and "how you look to others" cannot drift apart.
 */
export function StudentCard({ name, headline, headlineFallback, avatarUrl, tags, intent, distanceM, live, onOpen, cta }: Props) {
  const identity = (
    <>
      <Avatar url={avatarUrl} name={name} size={60} live={live} />
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-right text-[18px] leading-snug font-extrabold text-ink">{name}</span>
        {headline ? (
          <span dir="auto" className="mt-0.5 line-clamp-2 block text-right text-sm leading-snug text-ink/70">{headline}</span>
        ) : headlineFallback ? (
          <span className="mt-0.5 block text-sm leading-snug text-muted italic">{headlineFallback}</span>
        ) : null}
        {intent && (
          <span dir="auto" className="mt-2 flex items-start gap-1.5 rounded-xl bg-bg px-2.5 py-1.5 text-right text-[13px] leading-snug text-ink/80">
            <MessageCircle size={13} aria-hidden className="mt-[3px] shrink-0 text-cta" />
            <span>
              <span className="font-bold text-ink">כרגע: </span>
              {intent}
            </span>
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <DistancePill meters={distanceM} />
        </span>
        <TagChips tags={tags} className="mt-1.5" />
      </span>
    </>
  );

  return (
    <div className="card card-elevated rounded-2xl p-3.5">
      {onOpen ? (
        <button onClick={onOpen} className="flex w-full items-start gap-3.5 text-start transition-opacity active:opacity-75">
          {identity}
        </button>
      ) : (
        <div className="flex w-full items-start gap-3.5 text-start">{identity}</div>
      )}
      <div className="mt-3.5">{cta}</div>
    </div>
  );
}
