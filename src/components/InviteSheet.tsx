import { Copy, MapPin, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from './BottomSheet';
import { copyText } from '../lib/inapp';
import { inviteUrl } from '../lib/invite';
import { toast } from '../lib/notify';
import type { Group } from '../lib/types';

/** QR + link for a room. The QR is drawn on the device (SVG), so it works with no network and no image host. */
export function InviteSheet({ open, onClose, group }: { open: boolean; onClose: () => void; group: Group }) {
  const url = group.invite_code ? inviteUrl(group.invite_code) : null;

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
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.05)]">
              <QRCodeSVG value={url} size={208} level="M" fgColor="#0F172A" bgColor="#FFFFFF" marginSize={0} title={`קוד הצטרפות ל${group.name}`} />
            </div>
            <p dir="ltr" className="mx-auto mt-3 max-w-full text-[11px] break-all text-muted select-all">{url}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={copy} className="btn-ghost flex items-center justify-center gap-2 px-3 text-sm font-bold">
                <Copy size={16} /> העתק קישור הזמנה
              </button>
              <button onClick={share} className="btn-primary flex items-center justify-center gap-2 px-3 text-sm">
                <Share2 size={16} /> שתף קישור
              </button>
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-2xl bg-bg px-4 py-5 text-sm text-muted">ההזמנות עוד לא פעילות (חסר עדכון במסד הנתונים).</p>
        )}
      </div>
    </BottomSheet>
  );
}
