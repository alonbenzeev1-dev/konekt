import { useState } from 'react';
import { Copy, Linkedin, Loader2, Lock, MapPin, UserCheck } from 'lucide-react';
import { KonektLogo } from '../components/KonektLogo';
import { signInWithLinkedIn } from '../lib/supabase';
import { toast } from '../lib/notify';
import { copyText, inAppBrowserName } from '../lib/inapp';
import { getPendingJoin, inviteUrl } from '../lib/invite';

const STEPS = [
  'ודאו שאתם בדפדפן רגיל (Safari / Chrome) ולא בתוך וואטסאפ',
  'התחברו עם חשבון ה-LinkedIn שלכם (לזיהוי אמין בקמפוס)',
];

const POINTS = [
  { Icon: MapPin, text: 'רואים מי נמצא עד 75 מטר ממך, עכשיו' },
  { Icon: UserCheck, text: 'כל חיבור וצ׳אט רק באישור של שני הצדדים' },
  { Icon: Lock, text: 'הקישורים שלך נעולים עד שתאשרו' },
];

export function Welcome() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const inApp = inAppBrowserName();
  const pendingJoin = getPendingJoin();
  // keep the invite when the link is copied out of an in-app browser (its storage is not shared with Safari / Chrome)
  const openUrl = pendingJoin ? inviteUrl(pendingJoin) : window.location.origin + '/';

  const copyLink = async () => {
    const ok = await copyText(openUrl);
    setCopied(ok);
    toast(ok ? 'הקישור הועתק. פתחו Safari / Chrome והדביקו.' : 'לא הצלחנו להעתיק. סמנו את הקישור והעתיקו ידנית.', ok ? 'success' : 'error');
  };

  const login = async () => {
    setBusy(true);
    try {
      await signInWithLinkedIn(); // redirects to LinkedIn
    } catch {
      toast('ההתחברות ל-LinkedIn נכשלה, נסו שוב', 'error');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col px-5 safe-top">
      <main className="flex flex-1 flex-col items-center pt-10 pb-4 text-center">
        <KonektLogo className="h-20 w-20 anim-card" />
        <h1 dir="ltr" className="mt-4 text-[34px] leading-none font-extrabold tracking-[0.14em] text-ink">KONEKT</h1>
        <p className="mt-2 text-xl font-bold text-cta">פשוט תתחברו.</p>
        <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted">רואים מי בקמפוס סביבכם עכשיו, ומתחברים רק באישור של שני הצדדים.</p>

        {/* the two things that decide whether sign-in works first time */}
        <section aria-labelledby="start-steps" className="card mt-7 w-full rounded-2xl p-4 text-start">
          <h2 id="start-steps" className="text-xs font-bold text-muted">כך מתחילים</h2>
          <ol className="mt-3">
            {STEPS.map((t, n) => (
              <li key={t} className={`relative flex items-start gap-3 ${n < STEPS.length - 1 ? 'pb-4' : ''}`}>
                {n < STEPS.length - 1 && <span aria-hidden className="absolute start-[13px] top-7 -bottom-0.5 w-px bg-line" />}
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cta text-xs font-extrabold text-white">{n + 1}</span>
                <span className="pt-[3px] text-sm leading-snug font-medium text-ink">{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <ul className="mt-5 w-full space-y-3 px-1 text-start">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-ink/80">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-cta">
                <Icon size={16} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-line/70 pt-4 pb-5 safe-bottom">
        {inApp && (
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-start text-amber-950">
            <p className="text-sm font-bold">פתחתם את KONEKT בתוך {inApp}</p>
            <p className="mt-1 text-xs leading-relaxed">
              הדפדפן הפנימי לא שומר סיסמאות ולא תומך ב-FaceID, אז ההתחברות ל-LinkedIn תהיה איטית. פתחו את הקישור ב-Safari / Chrome והתחברו בשנייה.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-sm font-bold text-white active:scale-[0.98]"
            >
              <Copy size={15} />
              {copied ? 'הועתק ✓ עכשיו הדביקו ב-Safari / Chrome' : 'העתק קישור לפתיחה ב-Safari / Chrome'}
            </button>
            <p dir="ltr" className="mt-2 select-all text-center text-[11px] break-all text-amber-900/70">{openUrl}</p>
          </div>
        )}
        {pendingJoin && (
          <p className="mb-3 rounded-2xl border border-primary/20 bg-primary-soft/60 px-3.5 py-2.5 text-center text-sm font-medium text-ink">
            קיבלתם הזמנה לחדר. אחרי ההתחברות תצטרפו אליו.
          </p>
        )}
        <button onClick={login} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2.5 py-4 text-lg">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Linkedin size={20} />}
          המשך עם LinkedIn
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed text-muted">
          <Lock size={12} className="shrink-0" />
          מ-LinkedIn נקבל רק שם ותמונה. שום דבר לא מתפרסם בפרופיל שלך.
        </p>
      </footer>
    </div>
  );
}
