import { useState } from 'react';
import { Bell, BellRing, Loader2, Share, SquarePlus, X } from 'lucide-react';
import { toast } from '../lib/notify';
import { usePushState, type PushState } from '../hooks/usePushState';

/** iPhone / iPad: push exists only for the home-screen app, so these two steps are the whole setup. */
function IosSteps() {
  return (
    <ol className="mt-3 space-y-2.5 rounded-2xl border border-line bg-bg p-3.5 text-[13px] leading-snug text-ink/85">
      <li className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs font-extrabold text-cta-press">1</span>
        <span className="pt-0.5">
          בתחתית Safari לחצו על כפתור השיתוף <Share size={15} aria-label="שיתוף" className="mx-0.5 inline align-text-bottom text-cta" /> ובחרו
          {' '}<span className="font-bold">״הוסף למסך הבית״</span>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs font-extrabold text-cta-press">2</span>
        <span className="pt-0.5">
          פתחו את KONEKT <SquarePlus size={15} aria-hidden className="mx-0.5 inline align-text-bottom text-cta" /> מהמסך הבית, וחזרו לכאן להפעיל את ההתראות.
        </span>
      </li>
    </ol>
  );
}

const SUBTITLE: Record<PushState, string> = {
  unsupported: 'הדפדפן הזה לא תומך בהתראות. אפשר לנסות ב-Chrome או ב-Safari מעודכן.',
  unconfigured: 'ההתראות עוד לא הוגדרו באפליקציה.',
  'ios-install': 'באייפון ההתראות עובדות רק כשהאפליקציה מותקנת על מסך הבית.',
  default: 'קבלו הודעה על בקשות, אישורים והודעות חדשות, גם כשהמסך נעול.',
  denied: 'ההתראות חסומות. אפשר לאפשר אותן בהגדרות הדפדפן או המכשיר, ואז לרענן.',
  off: 'כבוי במכשיר הזה. הפעילו כדי לקבל התראות למסך הנעילה.',
  on: 'פעיל במכשיר הזה. נשלח התראה על בקשות, אישורים והודעות.',
};

/** Profile card: "התראות למסך הנעילה". */
export function PushCard({ userId }: { userId: string }) {
  const { state, busy, enable, disable } = usePushState(userId);
  if (!state) return null;

  const canToggle = state === 'default' || state === 'off' || state === 'on';
  const checked = state === 'on';

  const flip = async () => {
    if (busy) return;
    if (checked) return void (await disable());
    const next = await enable();
    if (next === 'on') toast('ההתראות פועלות. נעדכן אותך על בקשות והודעות', 'success');
    else if (next === 'denied') toast('ההתראות חסומות. אפשר לאפשר אותן בהגדרות הדפדפן.', 'info');
    else toast('לא הצלחנו להפעיל התראות. נסו שוב.', 'error');
  };

  return (
    <section aria-labelledby="push-title" className="card rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-cta">
          {checked ? <BellRing size={20} /> : <Bell size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="push-title" className="font-bold text-ink">התראות למסך הנעילה</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted">{SUBTITLE[state]}</p>
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label="התראות למסך הנעילה"
            disabled={busy}
            onClick={() => void flip()}
            className="flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={20} className="animate-spin text-cta" />
            ) : (
              <span aria-hidden className={`relative h-7 w-12 rounded-full border transition-colors ${checked ? 'border-cta bg-cta' : 'border-line bg-bg'}`}>
                <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
              </span>
            )}
          </button>
        )}
      </div>
      {state === 'ios-install' && <IosSteps />}
    </section>
  );
}

const DISMISS_KEY = 'konekt-push-prompt-dismissed';
const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/** A quiet nudge on the requests screen, once a request exists: the moment push is clearly useful. */
export function PushPromptBanner({ userId, hasRequests }: { userId: string; hasRequests: boolean }) {
  const { state, busy, enable } = usePushState(userId);
  const [hidden, setHidden] = useState(wasDismissed);
  const [steps, setSteps] = useState(false);

  if (!hasRequests || hidden || (state !== 'default' && state !== 'ios-install')) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: it just comes back next time */
    }
    setHidden(true);
  };

  const act = async () => {
    if (state === 'ios-install') return setSteps((v) => !v);
    const next = await enable();
    if (next === 'on') toast('ההתראות פועלות', 'success');
    else if (next === 'denied') toast('ההתראות חסומות. אפשר לאפשר אותן בהגדרות הדפדפן.', 'info');
    if (next !== 'default') setHidden(true);
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft/60 p-3.5">
      <div className="flex items-center gap-3">
        <Bell size={20} aria-hidden className="shrink-0 text-cta" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug font-bold text-ink">רוצים לדעת מיד כשמאשרים? הפעילו התראות.</p>
        <button
          onClick={() => void act()}
          disabled={busy}
          className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-cta px-4 text-sm font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {state === 'ios-install' ? 'איך?' : 'הפעל'}
        </button>
        <button onClick={dismiss} aria-label="סגירה" className="-ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-card">
          <X size={17} />
        </button>
      </div>
      {steps && state === 'ios-install' && <IosSteps />}
    </div>
  );
}
