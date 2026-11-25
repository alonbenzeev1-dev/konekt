import { useEffect, useState } from 'react';
import { Bell, Loader2, LogOut, MapPin } from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { PhotoPicker } from '../components/PhotoPicker';
import { LinkFields } from '../components/LinkFields';
import { supabase } from '../lib/supabase';
import { normalizeInstagram, normalizeLinkedIn } from '../lib/social';
import { importLinkedInAvatar, upsertProfile, uploadAvatar } from '../lib/profile';
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
      toast('משהו השתבש — נסו שוב', 'error');
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col px-6 safe-top">
      <header className="flex items-center justify-between pt-3">
        <Wordmark className="text-[15px]" />
        <button onClick={() => supabase.auth.signOut().then(() => location.reload())} className="flex items-center gap-1 text-xs text-muted">
          <LogOut size={13} /> התנתקות
        </button>
      </header>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-extrabold text-ink">כמעט שם{initialName ? `, ${initialName}` : ''}!</h1>
        <p className="mt-1 text-sm text-muted">עוד כמה פרטים וזהו. 15 שניות.</p>
      </div>

      <main className="mt-6 flex-1 space-y-5">
        <PhotoPicker
          preview={preview}
          size={108}
          label="החלפת התמונה מ-LinkedIn"
          onPick={(f) => {
            setFile(f);
            setPreview(URL.createObjectURL(f));
          }}
        />
        <p className="-mt-2 text-center text-[11px] text-muted">{file ? 'תמונה חדשה' : 'התמונה מ-LinkedIn'} · אפשר להחליף</p>

        <div className="card space-y-4 rounded-3xl p-4">
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
          <LinkFields linkedin={linkedin} onLinkedin={setLinkedin} instagram={instagram} onInstagram={setInstagram} linkedinError={liBad} instagramError={igBad} autoCapture />
        </div>
      </main>

      <footer className="py-6 safe-bottom">
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
