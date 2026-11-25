import { useState } from 'react';
import { Loader2, LogOut, MessageSquareHeart, Star, Trash2 } from 'lucide-react';
import { PhotoPicker } from '../components/PhotoPicker';
import { LinkFields } from '../components/LinkFields';
import { CAMPUS_TAGS, MAX_TAGS } from '../lib/tags';
import { VisibilityToggle } from '../components/VisibilityToggle';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/notify';
import { normalizeInstagram, normalizeLinkedIn } from '../lib/social';
import { uploadAvatar, upsertProfile } from '../lib/profile';
import type { MyProfile } from '../lib/types';

interface Props {
  profile: MyProfile;
  onProfile: (p: MyProfile) => void;
  visible: boolean;
  onToggle: (v: boolean) => void;
  onSignedOut: () => void;
}

export function Profile({ profile, onProfile, visible, onToggle, onSignedOut }: Props) {
  const [name, setName] = useState(profile.first_name);
  const [headline, setHeadline] = useState(profile.headline ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [instagram, setInstagram] = useState(profile.instagram_handle ?? '');
  const [tags, setTags] = useState<string[]>(profile.tags ?? []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const liNorm = normalizeLinkedIn(linkedin);
  const igNorm = instagram.trim() ? normalizeInstagram(instagram) : null;
  const liBad = !liNorm;
  const igBad = !!instagram.trim() && !igNorm;
  const tagsKey = (t: string[]) => [...t].sort().join('|');
  const tagsChanged = tagsKey(tags) !== tagsKey(profile.tags ?? []);
  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < MAX_TAGS ? [...prev, t] : prev));
  const dirty =
    tagsChanged ||
    name.trim() !== profile.first_name ||
    (headline.trim() || null) !== profile.headline ||
    liNorm !== profile.linkedin_url ||
    igNorm !== profile.instagram_handle;

  const changePhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      const avatar_url = await uploadAvatar(profile.id, file);
      const { data, error } = await supabase.from('profiles').update({ avatar_url }).eq('id', profile.id).select().single();
      if (error) throw error;
      onProfile(data as MyProfile);
      toast('התמונה עודכנה', 'success');
    } catch {
      toast('העלאת התמונה נכשלה', 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim() || liBad || igBad) {
      toast(!name.trim() ? 'צריך שם פרטי' : 'הקישור לא תקין', 'error');
      return;
    }
    setSaving(true);
    try {
      const p = await upsertProfile(profile.id, {
        first_name: name.trim().slice(0, 30),
        headline: headline.trim().slice(0, 60) || null,
        linkedin_url: liNorm,
        instagram_handle: igNorm,
        // only sent when edited, so saving still works before the tags migration is applied
        ...(tagsChanged ? { tags } : {}),
      });
      onProfile(p);
      toast('נשמר', 'success');
    } catch {
      toast('השמירה נכשלה', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteMe = async () => {
    if (!window.confirm('למחוק את הפרופיל, הצ׳אטים והבקשות שלך? אי אפשר לבטל.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) return toast('המחיקה נכשלה', 'error');
    await supabase.auth.signOut();
    onSignedOut();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    onSignedOut();
  };

  return (
    <div className="space-y-5 px-4 pt-2 pb-8">
      <section className="card rounded-3xl p-5">
        <div className="relative">
          <PhotoPicker preview={profile.avatar_url} onPick={changePhoto} size={108} />
          {photoBusy && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          )}
        </div>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-bold text-ink">שם פרטי</span>
          <input className="field font-bold" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
            <span>שורת תיאור קצרה <span className="font-normal text-muted">(מופיעה בסביבה)</span></span>
            <span className="font-normal tabular-nums text-muted">{headline.length}/60</span>
          </span>
          <input className="field" value={headline} maxLength={60} onChange={(e) => setHeadline(e.target.value)} placeholder="למשל: הנדסת תעשייה וניהול, שנה ג׳" />
        </label>
        <div className="mt-4">
          <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
            <span>תגיות <span className="font-normal text-muted">(מופיעות בכרטיס שלך, עד {MAX_TAGS})</span></span>
            <span className="font-normal tabular-nums text-muted">{tags.length}/{MAX_TAGS}</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CAMPUS_TAGS.map((t) => {
              const on = tags.includes(t);
              const locked = !on && tags.length >= MAX_TAGS;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
                    on ? 'border-primary bg-primary text-white' : 'border-line bg-card text-ink'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4">
          <LinkFields linkedin={linkedin} onLinkedin={setLinkedin} instagram={instagram} onInstagram={setInstagram} linkedinError={liBad} instagramError={igBad} />
        </div>
        <button onClick={save} disabled={!dirty || saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3">
          {saving && <Loader2 size={18} className="animate-spin" />}
          שמירת שינויים
        </button>
      </section>

      <section className="card flex items-center justify-between gap-3 rounded-3xl p-5">
        <div>
          <p className="font-bold text-ink">נראות בסביבה</p>
          <p className="text-xs text-muted">{visible ? 'אנשים ברדיוס 75 מ׳ רואים אותך' : 'אף אחד לא רואה אותך כרגע'}</p>
          <p className="mt-0.5 text-[11px] text-muted">השאר מיקום פעיל כדי שחברים בקמפוס יראו אותך</p>
        </div>
        <VisibilityToggle on={visible} onChange={onToggle} />
      </section>

      <Feedback userId={profile.id} />

      <div className="flex items-center justify-center gap-5">
        <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <LogOut size={13} /> התנתקות
        </button>
        <button onClick={deleteMe} className="flex items-center gap-1.5 text-xs text-muted hover:text-danger">
          <Trash2 size={13} /> מחיקת הפרופיל
        </button>
      </div>
      <p className="text-center text-[10px] text-muted/70">KONEKT MVP · v0.2 · פשוט תתחברו.</p>
    </div>
  );
}

function Feedback({ userId }: { userId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!rating) return toast('בחרו דירוג', 'error');
    setBusy(true);
    const { error } = await supabase.from('feedback').insert({ user_id: userId, rating, comment: comment.trim() || null });
    setBusy(false);
    if (error) return toast('השליחה נכשלה', 'error');
    setSent(true);
    setRating(0);
    setComment('');
    toast('תודה! זה עוזר לנו המון', 'success');
  };

  return (
    <section className="card rounded-3xl p-5">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <MessageSquareHeart size={18} className="text-primary" />
        פידבק על KONEKT
      </h3>
      {sent ? (
        <div className="mt-3 text-sm text-muted">
          קיבלנו, תודה 🙏{' '}
          <button className="text-primary underline-offset-2 hover:underline" onClick={() => setSent(false)}>
            לשלוח עוד?
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex justify-center gap-1.5" dir="ltr" role="radiogroup" aria-label="דירוג">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים`} className="p-1">
                <Star
                  size={30}
                  strokeWidth={1.6}
                  className={n <= rating ? 'fill-primary text-primary' : 'text-line'}
                />
              </button>
            ))}
          </div>
          <textarea
            className="field mt-3 min-h-[84px] resize-none text-sm"
            placeholder="מה עבד? מה חסר? מה מעצבן?"
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button onClick={submit} disabled={busy || !rating} className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold">
            {busy && <Loader2 size={16} className="animate-spin" />}
            שליחת פידבק
          </button>
        </>
      )}
    </section>
  );
}
