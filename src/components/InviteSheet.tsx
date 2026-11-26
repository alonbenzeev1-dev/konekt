import { useState } from 'react';
import { Copy, Loader2, Lock, MapPin, RefreshCw, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from './BottomSheet';
import { copyText } from '../lib/inapp';
import { inviteUrl } from '../lib/invite';
import { toast } from '../lib/notify';
import type { Group } from '../lib/types';

/** QR + link for a room. The QR is drawn on the device (SVG), so it works with no network and no image host. */
export function InviteSheet({
  open,
  onClose,
  group,
  isCreator = false,
  onReset,
  onLock,
}: {
  open: boolean;
  onClose: () => void;
  group: Group;
  /** The room's creator can lock new joins and reset the code. */
  isCreator?: boolean;
  onReset?: () => Promise<{ error: string | null }>;
  onLock?: (locked: boolean) => Promise<{ error: string | null }>;
}) {
  const url = group.invite_code ? inviteUrl(group.invite_code) : null;
  const locked = group.invites_locked === true;
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    if (!onReset) return;
    setResetting(true);
    const { error } = await onReset();
    setResetting(false);
    setConfirmReset(false);
    if (!error) toast('הקישור אופס. הקישורים וקודי ה-QR הקודמים לא עובדים יותר.', 'success');
  };

  const copy = async () => {
    if (!url) return;
    const ok = await copyText(url);
    toast(ok ? 'קישור ההזמנה הועתק' : 'לא הצלחנו להעתיק. סמנו את הקישור והעתיקו ידנית.', ok ? 'success' : 'error');
  };

  const share = async () => {
    if (!url) return;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `KONEKT · ${group.name}`, text: `הצטרפו לחדר "${group.name}" ב-KONEKT`, url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // closed the share sheet
    }
    await copy();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="text-center">
        <h3 className="text-xl font-extrabold text-ink">הזמנה ל״{group.name}״</h3>
        {group.location_tag && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-cta-press">
            <MapPin size={12} /> {group.location_tag}
          </p>
        )}
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-ink/70">
          סרקו את הקוד או שלחו את הקישור. מי שמצטרף/ת רואה את חברי החדר, והם רואים אותו/ה.
        </p>

        {url ? (
          <>
            <div className={`mx-auto mt-4 w-fit rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition-opacity ${locked ? 'opacity-40' : ''}`}>
              <QRCodeSVG value={url} size={208} level="M" fgColor="#0F172A" bgColor="#FFFFFF" marginSize={0} title={`קוד הצטרפות ל${group.name}`} />
            </div>
            <p dir="ltr" className="mx-auto mt-3 max-w-full text-[11px] break-all text-muted select-all">{url}</p>
            {locked && (
              <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1.5 text-xs font-bold text-ink/80">
                <Lock size={13} /> החדר נעול: מי שאינו חבר לא יכול להצטרף
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={copy} className="btn-ghost flex items-center justify-center gap-2 px-3 text-sm font-bold">
                <Copy size={16} /> העתק קישור הזמנה
              </button>
              <button onClick={share} className="btn-primary flex items-center justify-center gap-2 px-3 text-sm">
                <Share2 size={16} /> שתף קישור
              </button>
            </div>
            {isCreator && onLock && onReset && (
              <div className="mt-5 space-y-2 border-t border-line pt-4 text-start">
                <p className="text-xs font-bold text-muted">ניהול הקישור (רק ליוצר/ת החדר)</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={locked}
                  onClick={() => void onLock(!locked)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-3.5 text-start transition-transform active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-sm font-bold text-ink">נעילת הצטרפות חדשה</span>
                    <span className="block text-[11px] text-muted">חברים קיימים נשארים. אפשר לפתוח שוב בכל רגע.</span>
                  </span>
                  <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${locked ? 'border-cta bg-cta' : 'border-line bg-bg'}`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${locked ? 'translate-x-5' : 'translate-x-0'} left-0.5`} />
                  </span>
                </button>
                {confirmReset ? (
                  <div className="rounded-xl border border-danger/30 bg-card p-3">
                    <p className="text-sm font-bold text-ink">לאפס את קישור ההזמנה?</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">הקישור וקוד ה-QR הנוכחיים יפסיקו לעבוד, ויווצרו חדשים. חברים קיימים לא יושפעו.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setConfirmReset(false)} disabled={resetting} className="btn-ghost min-h-[44px] text-sm font-bold">ביטול</button>
                      <button type="button" onClick={() => void reset()} disabled={resetting} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-danger px-3 text-sm font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-60">
                        {resetting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} אפס קישור
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmReset(true)} className="btn-ghost flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-bold text-danger">
                    <RefreshCw size={16} /> אפס קישור הזמנה
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="mt-5 rounded-2xl bg-bg px-4 py-5 text-sm text-muted">ההזמנות עוד לא פעילות (חסר עדכון במסד הנתונים).</p>
        )}
      </div>
    </BottomSheet>
  );
}
