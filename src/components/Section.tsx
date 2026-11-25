import type { ReactNode } from 'react';

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-bold text-ink">
        {title}
        {count != null && <span className="rounded-full bg-cta px-2 text-xs text-white">{count}</span>}
      </h2>
      <ul className="space-y-2.5">{children}</ul>
    </section>
  );
}
