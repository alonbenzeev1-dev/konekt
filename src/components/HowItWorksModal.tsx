import { useEffect, useRef, useState } from 'react';
import { MapPin, MessageCircle, UserCheck, type LucideIcon } from 'lucide-react';

export const GUIDE_KEY = 'konekt_seen_guide_v1';

export function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    /* private mode: the guide may show again next visit */
  }
}

const SLIDES: { Icon: LucideIcon; tab: string; title: string; body: string }[] = [
  {
    Icon: MapPin,
    tab: 'סביבי',
    title: 'מגלים מי סביבך',
    body: 'הדליקו את מתג ״גלוי בסביבה״ כדי לראות סטודנטים שנמצאים לידכם כרגע. המיקום המדויק שלכם לעולם לא נחשף לאחרים.',
  },
  {
    Icon: UserCheck,
    tab: 'בקשות',
    title: 'חיבורים בשליטה מלאה',
    body: 'שלח בקשת LinkedIn או Instagram בלחיצה. לאחר האישור נפתח קישור ישיר לפרופיל למשך 48 שעות — ובקשות שלא אושרו פגות אוטומטית אחרי שעתיים.',
  },
  {
    Icon: MessageCircle,
    tab: 'צ׳אטים',
    title: 'צ׳אטים וקבוצות פרטיות',
    body: 'התחילו שיחה אישית או פתחו קבוצה פרטית לקורס או לאירוע, ושתפו את הלינקדאין שלכם עם כל חברי הקבוצה בלחיצה.',
  },
];

/** 3-slide first-run walkthrough. `onClose` fires on skip, finish, or Escape. */
export function HowItWorksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // a new onClose must not restart the slides

  useEffect(() => {
    if (!open) return;
    setI(0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const last = i === SLIDES.length - 1;
  const { Icon, tab, title, body } = SLIDES[i];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="איך KONEKT עובד">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade" />
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-3xl bg-card px-6 pt-8 pb-5 text-center shadow-2xl anim-rise">
        <div key={i} className="anim-fade">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon size={36} strokeWidth={1.9} />
          </span>
          <p className="mt-5 text-xs font-bold text-primary">
            {i + 1}/{SLIDES.length} · {tab}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-ink">{title}</h2>
          <p className="mx-auto mt-3 min-h-[96px] max-w-[300px] text-[15px] leading-relaxed text-ink/80">{body}</p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2" role="tablist" aria-label="שקופיות">
          {SLIDES.map((s, n) => (
            <button
              key={s.tab}
              role="tab"
              aria-selected={n === i}
              aria-label={`שקופית ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-primary' : 'w-2 bg-line'}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {!last && (
            <button onClick={onClose} className="px-4 py-3 text-sm font-bold text-muted active:opacity-70">
              דלג
            </button>
          )}
          <button
            onClick={last ? onClose : () => setI(i + 1)}
            className="btn-primary flex-1 py-3.5 text-base"
          >
            {last ? 'בואו נתחיל' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}
