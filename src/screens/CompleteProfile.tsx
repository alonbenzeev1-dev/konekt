import { useEffect, useState } from 'react';
import { Bell, Loader2, LogOut, MapPin, Check } from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { PhotoPicker } from '../components/PhotoPicker';
import { LinkFields } from '../components/LinkFields';
import { TypewriterInput } from '../components/TypewriterInput';
import { supabase } from '../lib/supabase';
import { normalizeInstagram, normalizeLinkedIn } from '../lib/social';
import { importLinkedInAvatar, isInvalidLinkError, upsertProfile, uploadAvatar } from '../lib/profile';
import { requestGeoPermission } from '../lib/geo';
import { requestNotificationPermission, subscribeToPush, toast } from '../lib/notify';
import type { MyProfile } from '../lib/types';

interface Props {
  uid: string;
  initialName: string;
  linkedinPicture: string | null;
  onDone: (p: MyProfile) => void;
}

/** Right after LinkedIn login: confirm name, short headline, paste LinkedIn URL, optional Instagram. */
export function CompleteProfile({ uid, initialName, linkedinPicture, onDone }: Props) {
  const [name, setName] = useState(initialName);
  const [headline, setHeadline] = useState('');
  const [intent, setIntent] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(linkedinPicture);
  const [busy, setBusy] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => () => { if (file && preview) URL.revokeObjectURL(preview); }, [file, preview]);

  const liNorm = normalizeLinkedIn(linkedin);
  const igNorm = instagram.trim() ? normalizeInstagram(instagram) : null;
  const liBad = (tried || !!linkedin.trim()) && !liNorm;
  const igBad = !!instagram.trim() && !igNorm;
  const ready = name.trim().length > 0 && !!liNorm && !igBad;

  const submit = async () => {
    setTried(true);
    if (!ready) {
      toast(!name.trim() ? 'מה השם הפרטי שלך?' : !liNorm ? 'צריך קישור תקין ל-LinkedIn' : 'שם המשתמש באינסטגרם לא תקין', 'error');
      return;
    }
    // iOS: the permission prompt must start inside the tap, before any await.
    const permP = requestNotificationPermission();
    try {
      setBusy('מבקש מיקום…');
      let pos: GeolocationPosition | null = null;
      try {
        pos = await requestGeoPermission();
      } catch {
        toast('בלי הרשאת מיקום לא נוכל להראות מי סביבך — אפשר לאשר אחר כך', 'error');
      }

      setBusy('שומר…');
      let profile = await upsertProfile(uid, {
        first_name: name.trim().slice(0, 30),
        headline: headline.trim().slice(0, 60) || null,
        // only sent when filled in, so sign-up still works before the current_intent migration
        ...(intent.trim() ? { current_intent: intent.trim().slice(0, 60) } : {}),
        linkedin_url: liNorm,
        instagram_handle: igNorm,
        avatar_url: file ? null : linkedinPicture,
        is_visible: true,
        ...(pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {}),
      });

      setBusy('שומר תמונה…');
      let avatar: string | null = null;
      if (file) avatar = await uploadAvatar(uid, file).catch(() => null);
      else avatar = await importLinkedInAvatar(uid, linkedinPicture);
      if (avatar && avatar !== profile.avatar_url) profile = { ...profile, avatar_url: avatar };
      if (!avatar) toast('לא הצלחנו לשמור את תמונת ה-LinkedIn — אפשר להעלות תמונה בפרופיל', 'info');

      const perm = await permP;
      if (perm === 'granted') void subscribeToPush(uid);
      try { navigator.vibrate?.(40); } catch { /* noop */ }
      onDone(profile);
    } catch (e) {
      console.error(e);
      toast(isInvalidLinkError(e) ? 'הקישור ל-LinkedIn לא תקין. הדביקו קישור בפורמט linkedin.com/in/השם-שלכם' : 'משהו השתבש — נסו שוב', 'error');
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col px-5 safe-top">
      <header className="flex min-h-[44px] items-center justify-between pt-1">
        <Wordmark className="text-[15px]" />
        <button
          onClick={() => supabase.auth.signOut().then(() => location.reload())}
          className="-me-2 flex min-h-[44px] items-center gap-1 px-2 text-xs font-medium text-muted"
        >
          <LogOut size={14} /> התנתקות
        </button>
      </header>

      {/* where the student is in the sign-up: signed in -> profile (here) -> in the app */}
      <ol aria-label="התקדמות" className="mt-3 flex items-center gap-2">
        <li className="flex items-center gap-1.5 text-xs font-bold text-live">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-live text-white"><Check size={12} strokeWidth={3} /></span>
          התחברות
        </li>
        <span aria-hidden className="h-px flex-1 bg-live/40" />
        <li aria-current="step" className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cta text-[11px] font-extrabold text-white">2</span>
          הפרופיל שלך
        </li>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <li className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-card text-[11px] font-bold">3</span>
          מתחילים
        </li>
      </ol>

      <div className="mt-6 text-center">
        <h1 className="text-2xl leading-tight font-extrabold text-ink">כמעט שם{initialName ? `, ${initialName}` : ''}</h1>
        <p className="mt-1 text-sm text-muted">עוד כמה פרטים וזהו. 15 שניות.</p>
      </div>

      <main className="mt-6 flex-1 space-y-4">
        <section className="card rounded-2xl p-4">
          <div className="flex flex-col items-center">
            <PhotoPicker
              preview={preview}
              size={96}
              label="החלפת התמונה מ-LinkedIn"
              onPick={(f) => {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
            <p className="mt-2 text-center text-xs text-muted">{file ? 'תמונה חדשה' : 'התמונה מ-LinkedIn'} · אפשר להחליף</p>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-ink">שם פרטי</span>
              <input className={`field font-bold ${tried && !name.trim() ? '!border-danger' : ''}`} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
                <span>שורת תיאור קצרה <span className="font-normal text-muted">(מופיעה בסביבה)</span></span>
                <span className="font-normal text-muted tabular-nums">{headline.length}/60</span>
              </span>
              <input className="field" maxLength={60} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="למשל: מדעי המחשב, שנה ב׳" />
            </label>
            <div>
              <label htmlFor="onboarding-intent" className="mb-1.5 block text-xs font-bold text-ink">
                מה הקטע שלך כרגע? <span className="font-normal text-muted">(לא חובה)</span>
              </label>
              <TypewriterInput id="onboarding-intent" value={intent} onChange={setIntent} />
            </div>
          </div>
        </section>

        <section className="card rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-bold text-ink">הקישורים שלך</h2>
          <LinkFields linkedin={linkedin} onLinkedin={setLinkedin} instagram={instagram} onInstagram={setInstagram} linkedinError={liBad} instagramError={igBad} autoCapture />
        </section>
      </main>

      <footer className="py-5 safe-bottom">
        <button onClick={submit} disabled={!!busy} className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg">
          {busy ? (<><Loader2 size={20} className="animate-spin" />{busy}</>) : 'הפעל את KONEKT'}
        </button>
        <p className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><MapPin size={12} /> מיקום</span>
          <span className="inline-flex items-center gap-1"><Bell size={12} /> התראות</span>
          <span>· נבקש הרשאה בלחיצה</span>
        </p>
      </footer>
    </div>
  );
}
