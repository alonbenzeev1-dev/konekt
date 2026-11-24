import { useEffect, type ReactNode } from 'react';

export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="סגירה" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 shadow-2xl safe-bottom anim-rise">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}
