import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { KonektLogo } from './KonektLogo';
import { inAppBrowserName } from '../lib/inapp';

const DISMISS_KEY = 'konekt_install_dismissed';
const DISMISS_DAYS = 7;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome fires this once, early. Capture it at module load (before any screen mounts) and share it.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iOS Safari proper: the only iOS browser flow we can describe reliably ("Share → Add to Home Screen"). */
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && !inAppBrowserName(ua);
};

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Dismissible "add to home screen" card; hidden once installed, dismissed, or when the browser offers no install path. */
export function InstallPwaBanner() {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed());

  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  if (hidden || isStandalone()) return null;
  const ios = isIosSafari();
  if (!deferred && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };

  const install = async () => {
    const ev = deferred;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null;
    if (outcome === 'accepted') setHidden(true);
    else rerender((n) => n + 1);
  };

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-primary/20 bg-primary-soft/60 p-3.5 anim-card" role="region" aria-label="התקנת האפליקציה">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          <KonektLogo className="h-9 w-9" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug font-medium text-ink">
          התקן את KONEKT למסך הבית כדי להישאר זמין בסביבה ולקבל התראות על בקשות לינקדאין
        </p>
        <button onClick={dismiss} aria-label="סגירה" className="-m-1 shrink-0 rounded-full p-1 text-muted active:bg-card">
          <X size={18} />
        </button>
      </div>

      {deferred ? (
        <button onClick={install} className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm">
          <Download size={16} />
          התקן עכשיו
        </button>
      ) : (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-card px-3 py-2.5 text-[13px] leading-snug text-ink">
          <li className="flex items-start gap-2">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">1</span>
            <span className="min-w-0">
              לחצו על כפתור השיתוף (הריבוע עם החץ למעלה){' '}
              <Share size={15} className="inline align-text-bottom text-[#0A66C2]" /> בסרגל הדפדפן
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">2</span>
            <span className="min-w-0">
              גללו למטה ובחרו <span className="font-bold">״הוסף למסך הבית״</span> (Add to Home Screen){' '}
              <SquarePlus size={15} className="inline align-text-bottom text-ink" />
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}
