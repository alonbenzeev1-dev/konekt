import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { onToast, type ToastItem } from '../lib/notify';

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((prev) => [...prev.slice(-2), t]);
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.kind === 'alert' ? 5000 : 3200);
      }),
    [],
  );
  const Icon = { alert: BellRing, success: CheckCircle2, error: AlertCircle, info: Info };
  const color = { alert: 'text-primary', success: 'text-live', error: 'text-danger', info: 'text-muted' };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite">
      {items.map((t) => {
        const I = Icon[t.kind];
        return (
          <div key={t.id} className="card anim-toast mt-2 flex w-full max-w-[440px] items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg">
            <I size={18} className={color[t.kind]} />
            <span className="flex-1 text-ink">{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
