import { useState } from 'react';
import { Copy, Linkedin, Loader2, Lock, MapPin, UserCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { signInWithLinkedIn } from '../lib/supabase';
import { toast } from '../lib/notify';
import { copyText, inAppBrowserName } from '../lib/inapp';

export function Welcome() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const inApp = inAppBrowserName();
  const openUrl = window.location.origin + '/';

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

  const points = [
    { Icon: MapPin, text: 'רואים מי נמצא עד 75 מטר ממך, עכשיו' },
    { Icon: UserCheck, text: 'כל חיבור וצ׳אט רק באישור של שני הצדדים' },
    { Icon: Lock, text: 'הקישורים שלך נעולים עד שתאשרו' },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col px-6 safe-top">
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo size={84} />
        <h1 dir="ltr" className="mt-6 text-4xl font-extrabold tracking-[0.14em] text-ink">KONEKT</h1>
        <p className="mt-2 text-2xl font-bold text-primary">פשוט תתחברו.</p>

        <ul className="card mt-10 w-full space-y-3.5 rounded-3xl p-5 text-start">
          {points.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[15px] text-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </main>

      <footer className="py-6 safe-bottom">
        {inApp && (
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-start text-amber-950">
            <p className="text-sm font-bold">פתחתם את KONEKT בתוך {inApp}</p>
            <p className="mt-1 text-xs leading-relaxed">
              הדפדפן הפנימי לא שומר סיסמאות ולא תומך ב-FaceID, אז ההתחברות ל-LinkedIn תהיה איטית. פתחו את הקישור ב-Safari / Chrome והתחברו בשנייה.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
            >
              <Copy size={15} />
              {copied ? 'הועתק ✓ עכשיו הדביקו ב-Safari / Chrome' : 'העתק קישור לפתיחה ב-Safari / Chrome'}
            </button>
            <p dir="ltr" className="mt-2 select-all break-all text-center text-[11px] text-amber-900/70">{openUrl}</p>
          </div>
        )}
        <button onClick={login} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2.5 py-4 text-lg">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Linkedin size={20} />}
          המשך עם LinkedIn
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
          מ-LinkedIn נקבל רק שם ותמונה. שום דבר לא מתפרסם בפרופיל שלך.
        </p>
      </footer>
    </div>
  );
}
