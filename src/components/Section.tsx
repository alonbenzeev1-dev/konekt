import type { ReactNode } from 'react';

export function Section({ title, count, hint, children }: { title: string; count?: number; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-ink">
        {title}
        {count != null && <span className="rounded-full bg-cta px-2 text-xs text-white">{count}</span>}
      </h2>
      {hint ? <p className="mt-0.5 mb-2.5 px-1 text-xs leading-snug text-muted">{hint}</p> : <div className="mb-2.5" />}
      <ul className="space-y-2.5">{children}</ul>
    </section>
  );
}
