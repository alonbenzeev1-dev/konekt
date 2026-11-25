import { useState } from 'react';
import { Linkedin, Loader2, Lock, MapPin, UserCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { signInWithLinkedIn } from '../lib/supabase';
import { toast } from '../lib/notify';

export function Welcome() {
  const [busy, setBusy] = useState(false);

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
        <button onClick={login} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2.5 py-4 text-lg">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Linkedin size={20} />}
          התחברות עם LinkedIn
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
          מ-LinkedIn נקבל רק שם ותמונה. שום דבר לא מתפרסם בפרופיל שלך.
        </p>
      </footer>
    </div>
  );
}
