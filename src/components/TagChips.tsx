import { MAX_TAGS } from '../lib/tags';

/** Compact read-only tags. Spans only, so it is safe inside a <button>. */
export function TagChips({ tags, className = '' }: { tags?: string[] | null; className?: string }) {
  const list = (tags ?? []).slice(0, MAX_TAGS);
  if (!list.length) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {list.map((t) => (
        <span key={t} className="rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] font-medium text-ink/75">
          {t}
        </span>
      ))}
    </span>
  );
}
