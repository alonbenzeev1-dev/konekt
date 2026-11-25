/** A placeholder block. Same radius / size as the thing it stands in for; pulses slowly (opacity only). */
export function Skeleton({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return <span aria-hidden className={`skeleton block ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined} />;
}

/** Shape of a nearby-student card (identity block + full-width action), shown while we locate and scan. */
export function NearbySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">סורקים אנשים בסביבה…</span>
      <ul aria-hidden className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="card card-elevated rounded-2xl p-3.5">
            <div className="flex items-start gap-3.5">
              <Skeleton className="h-[60px] w-[60px] shrink-0 !rounded-full" delay={i * 120} />
              <span className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-[18px] w-28" delay={i * 120} />
                <Skeleton className="h-3.5 w-44 max-w-full" delay={i * 120} />
                <Skeleton className="h-6 w-32 !rounded-full" delay={i * 120} />
              </span>
            </div>
            <Skeleton className="mt-3.5 h-11 w-full !rounded-xl" delay={i * 120} />
          </li>
        ))}
      </ul>
    </div>
  );
}
