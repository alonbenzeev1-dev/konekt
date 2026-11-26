import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Users } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { clearPendingJoin, getPendingJoin, isJoinAuto } from '../lib/invite';
import { toast } from '../lib/notify';
import type { GroupsData, InvitePreview } from '../hooks/useGroups';

/**
 * Handles an invite (?join=<code>) that was waiting when the app finished loading, whether the person was
 * already signed in or just came through LinkedIn + onboarding.
 *  - brand-new member who arrived through the invite: joins straight away and lands in the room;
 *  - everyone else: a one-tap "join this room?" card, so nobody is added to a room by merely opening a link.
 */
export function JoinInvite({ groups, onJoined }: { groups: GroupsData; onJoined: (groupId: string) => void }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [joining, setJoining] = useState(false);
  const code = useRef(getPendingJoin());
  const started = useRef(false);

  const finish = () => {
    clearPendingJoin();
    code.current = null;
    setPreview(null);
  };

  const join = async () => {
    const c = code.current;
    if (!c) return;
    setJoining(true);
    const { error, id } = await groups.joinByCode(c);
    setJoining(false);
    if (error || !id) {
      toast(error?.includes('locked') ? 'החדר סגור להצטרפות חדשה' : error?.includes('too many') ? 'החדר מלא' : error?.includes('not found') ? 'קישור ההזמנה לא תקף' : 'לא הצלחנו להצטרף. נסו שוב.', 'error');
      finish();
      return;
    }
    finish();
    onJoined(id);
  };

  // runs once per app load; `join` reads refs
  useEffect(() => {
    const c = code.current;
    if (!c || started.current) return;
    started.current = true;
    void (async () => {
      const p = await groups.previewInvite(c);
      if (!p) {
        toast('קישור ההזמנה לא תקף או שפג תוקפו', 'error');
        return finish();
      }
      if (p.already_member && p.group_id) {
        finish();
        return onJoined(p.group_id);
      }
      if (p.locked) {
        toast('החדר סגור להצטרפות חדשה. בקשו מיוצר/ת החדר לפתוח אותו.', 'error');
        return finish();
      }
      if (isJoinAuto()) return void join();
      setPreview(p);
    })();
  }, []);

  return (
    <BottomSheet open={!!preview} onClose={finish}>
      {preview && (
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-cta">
            <Users size={26} />
          </span>
          <p className="mt-3 text-xs font-bold text-muted">הוזמנתם להצטרף לחדר</p>
          <h3 dir="auto" className="mt-1 text-2xl font-extrabold text-ink">{preview.name}</h3>
          {preview.location_tag && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-cta-press">
              <MapPin size={12} /> {preview.location_tag}
            </p>
          )}
          {preview.description && <p dir="auto" className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-ink/70">{preview.description}</p>}
          <p className="mt-2 text-sm text-muted">
            <span className="font-bold text-ink tabular-nums">{preview.member_count}</span> חברים בחדר. כולם יראו את השם והתמונה שלכם.
          </p>
          <button onClick={() => void join()} disabled={joining} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 text-base">
            {joining ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
            הצטרף וכניסה לחדר
          </button>
          <button onClick={finish} disabled={joining} className="mx-auto mt-2 min-h-[44px] px-4 text-sm font-bold text-muted">
            לא עכשיו
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
