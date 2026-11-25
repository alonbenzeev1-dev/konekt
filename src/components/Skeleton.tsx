/** A placeholder block. Same radius / size as the thing it stands in for; pulses slowly (opacity only). */
export function Skeleton({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return <span aria-hidden className={`skeleton block ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined} />;
}

/** Shape of a nearby-student card, shown while we locate the phone and scan the area. */
export function NearbySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">סורקים אנשים בסביבה…</span>
      <ul aria-hidden className="space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="card flex min-h-[92px] items-center gap-3.5 rounded-2xl p-3.5">
            <Skeleton className="h-14 w-14 shrink-0 !rounded-full" delay={i * 120} />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-24" delay={i * 120} />
              <Skeleton className="h-3 w-40 max-w-full" delay={i * 120} />
              <Skeleton className="h-5 w-28 !rounded-full" delay={i * 120} />
            </span>
            <Skeleton className="h-9 w-[74px] shrink-0 !rounded-full" delay={i * 120} />
          </li>
        ))}
      </ul>
    </div>
  );
}
