import { useState, type ReactNode } from 'react';
import { ArrowUpLeft, Check, Clock, EyeOff, Instagram, Linkedin, Loader2, MapPinOff, MessageCircle, Send, UserPlus, Users, ChevronLeft } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { TagChips } from '../components/TagChips';
import { BottomSheet } from '../components/BottomSheet';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { CAMPUS_RADIUS_M, FEW_PEOPLE, RADIUS_M } from '../hooks/useNearby';
import { toast } from '../lib/notify';
import { inviteNearby, kindLabel } from '../lib/social';
import type { GeoStatus } from '../hooks/usePresence';
import type { Inbox } from '../hooks/useInbox';
import type { ConnectionRequest, NearbyUser, Platform, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  visible: boolean;
  onShow: () => void;
  geo: GeoStatus;
  users: NearbyUser[];
  campusCount: number | null;
  inbox: Inbox;
  onOpenChat: (chatId: string) => void;
}

/** Friendly proximity instead of a raw distance (indoor GPS is too fuzzy for exact meters). */
const proximityLabel = (m: number) => (m <= 30 ? 'ממש לידך' : 'באזור שלך');

export function Radar({ myId, visible, onShow, geo, users, campusCount, inbox, onOpenChat }: Props) {
  const [selected, setSelected] = useState<NearbyUser | null>(null);
  const live = visible && geo === 'ok';

  return (
    <div className="px-4 pb-6">
      <div
        className={`mt-1 mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${
          live ? 'border-live/30 bg-live-soft/60' : 'border-line bg-card'
        }`}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {live && <span className="absolute inset-0 rounded-full bg-live anim-ping" />}
          <span className={`relative h-2.5 w-2.5 rounded-full ${live ? 'bg-live' : 'bg-muted/50'}`} />
        </span>
        <span className="flex-1 text-sm font-bold text-ink">
          {live ? `פעיל בסביבה · רדיוס ${RADIUS_M} מ׳` : 'לא פעיל כרגע'}
        </span>
        {live && users.length > 0 && (
          <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-live shadow-sm">{users.length} לידך</span>
        )}
      </div>
      {live && <p className="-mt-2 mb-3 px-1 text-center text-[11px] text-muted">השאר מיקום פעיל כדי שחברים בקמפוס יראו אותך</p>}

      {!visible ? (
        <StateCard
          icon={<EyeOff size={24} />}
          title="את/ה מוסתר/ת"
          body="אף אחד לא רואה אותך בסביבה, וגם את/ה לא רואה אחרים. בקשות וצ׳אטים קיימים ממשיכים לעבוד."
          action={<button onClick={onShow} className="btn-primary mt-4 px-6 py-3">להופיע בסביבה</button>}
        />
      ) : geo === 'denied' ? (
        <StateCard
          icon={<MapPinOff size={24} />}
          title="אין הרשאת מיקום"
          body="כדי לראות מי סביבך צריך לאשר מיקום: הגדרות הדפדפן ← הרשאות אתר ← מיקום ← אפשר. אחר כך רעננו את הדף."
        />
      ) : geo === 'unavailable' ? (
        <StateCard icon={<MapPinOff size={24} />} title="לא מצליחים לאתר מיקום" body="בדקו שה-GPS פעיל ושאין מצב חיסכון סוללה קיצוני." />
      ) : geo !== 'ok' ? (
        <StateCard icon={<Loader2 size={24} className="animate-spin" />} title="מאתרים מיקום…" body="רגע אחד." />
      ) : (
        <>
          {users.length > 0 && (
            <ul className="space-y-2.5">
              {users.map((u, i) => (
                <li key={u.id} className="anim-card" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                  <button
                    onClick={() => setSelected(u)}
                    className="card flex w-full items-center gap-3.5 rounded-2xl p-3 text-start transition-transform active:scale-[0.985]"
                  >
                    <Avatar url={u.avatar_url} name={u.first_name} size={56} live />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-bold text-ink">{u.first_name}</span>
                      {u.headline && <span className="block truncate text-sm text-muted">{u.headline}</span>}
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {proximityLabel(u.distance_m)}
                      </span>
                      <TagChips tags={u.tags} className="mt-1.5" />
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-cta px-3 py-1.5 text-sm font-bold text-white">
                      התחבר
                      <ChevronLeft size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {users.length === 0 && <EmptyRadar campusCount={campusCount} />}
          {users.length > 0 && users.length < FEW_PEOPLE && (
            <button
              onClick={() => void inviteNearby(toast)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft/60 py-3 text-sm font-bold text-primary transition-transform active:scale-[0.98]"
            >
              <UserPlus size={16} /> הזמן את מי שלידך
            </button>
          )}
        </>
      )}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <PersonSheet
            myId={myId}
            user={selected}
            inbox={inbox}
            onOpenChat={(id) => {
              setSelected(null);
              onOpenChat(id);
            }}
            onBlocked={() => setSelected(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

/** Nobody within 75m: explain why and make inviting one tap. */
function EmptyRadar({ campusCount }: { campusCount: number | null }) {
  return (
    <div className="card rounded-3xl p-5 text-center anim-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-live-soft text-live">
        <Users size={22} />
      </div>
      <h3 className="text-base font-bold text-ink">אף אחד לידך עוד לא פתח את KONEKT</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {campusCount != null && campusCount > 0
          ? `${campusCount} פעילים עכשיו בקמפוס, ברדיוס ${CAMPUS_RADIUS_M / 1000} ק״מ ממך. `
          : ''}
        הסביבה מתמלאת כשחברים פותחים את האפליקציה. תזמינו את מי שיושב לידכם ותתחברו.
      </p>
      <button
        onClick={() => void inviteNearby(toast)}
        className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3 text-[15px]"
      >
        <UserPlus size={18} />
        הזמן את מי שלידך
      </button>
    </div>
  );
}

function PersonSheet({
  myId,
  user,
  inbox,
  onOpenChat,
  onBlocked,
}: {
  myId: string;
  user: NearbyUser;
  inbox: Inbox;
  onOpenChat: (chatId: string) => void;
  onBlocked: () => void;
}) {
  const [sending, setSending] = useState<RequestKind | null>(null);
  const [composing, setComposing] = useState(false);
  const [first, setFirst] = useState('');
  const now = Date.now();

  const requestFor = (k: RequestKind) =>
    inbox.requests.find(
      (x) =>
        x.sender_id === myId && x.receiver_id === user.id && x.kind === k &&
        (x.status === 'accepted' || (x.status === 'pending' && new Date(x.expires_at).getTime() > now)),
    ) ?? null;

  const openChat = inbox.threads.find((t) => t.partnerId === user.id && new Date(t.chat.expires_at).getTime() > now);
  const chatStatus = requestFor('chat')?.status ?? null;

  const request = async (k: RequestKind) => {
    setSending(k);
    const { error } = await inbox.sendRequest(user.id, k, k === 'chat' ? first : undefined);
    setSending(null);
    if (error) {
      toast(
        error.includes('chat already open')
          ? 'כבר יש ביניכם צ׳אט פתוח'
          : /no (linkedin|instagram)/.test(error)
            ? `${user.first_name} עדיין לא הוסיף/ה ${kindLabel[k as 'linkedin' | 'instagram']}`
            : error.includes('user unavailable')
              ? `${user.first_name} כבר לא זמין/ה`
              : 'לא הצלחנו לשלוח את הבקשה',
        'error',
      );
      return;
    }
    try { navigator.vibrate?.(30); } catch { /* noop */ }
    setComposing(false);
    toast(k === 'chat' ? `בקשת הצ׳אט נשלחה ל${user.first_name}` : `בקשת ${kindLabel[k]} נשלחה ל${user.first_name}`, 'success');
  };

  const block = async () => {
    const { error } = await inbox.block(user.id);
    if (error) return toast('לא הצלחנו לחסום', 'error');
    toast(`${user.first_name} הוסתר/ה. לא תראו זה את זה יותר.`, 'info');
    onBlocked();
  };

  const platforms: { k: Platform; has: boolean }[] = [
    { k: 'linkedin', has: user.has_linkedin },
    { k: 'instagram', has: user.has_instagram },
  ];

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <Avatar url={user.avatar_url} name={user.first_name} size={92} ring live />
        <h3 className="mt-3 text-2xl font-extrabold text-ink">{user.first_name}</h3>
        {user.headline && <p className="mt-0.5 max-w-[300px] text-sm text-muted">{user.headline}</p>}
        <TagChips tags={user.tags} className="mt-2 justify-center" />
        <p className="mt-1 text-xs font-bold text-primary">~{user.distance_m} מטר ממך</p>
      </div>

      {/* Chat (double opt-in: the first message is a request) */}
      <div className="mt-5">
        {openChat ? (
          <button onClick={() => onOpenChat(openChat.chat.id)} className="btn-primary flex w-full items-center justify-center gap-2 py-3.5">
            <MessageCircle size={19} /> פתיחת הצ׳אט
          </button>
        ) : chatStatus === 'pending' ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary-soft py-3.5 text-sm font-bold text-primary">
            <Clock size={16} /> בקשת הצ׳אט ממתינה לאישור
          </div>
        ) : composing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              rows={2}
              maxLength={500}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder={`הודעה ראשונה ל${user.first_name}…`}
              className="field resize-none"
            />
            <button
              onClick={() => request('chat')}
              disabled={!first.trim() || sending !== null}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              {sending === 'chat' ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
              שליחת בקשת צ׳אט
            </button>
            <p className="text-center text-[11px] text-muted">{user.first_name} יראה/תראה את ההודעה ויחליט/תחליט אם לפתוח צ׳אט (ל-24 שעות).</p>
          </div>
        ) : (
          <button onClick={() => setComposing(true)} className="btn-primary flex w-full items-center justify-center gap-2 py-3.5">
            <MessageCircle size={19} /> בקשת צ׳אט
          </button>
        )}
      </div>

      <p className="mt-5 mb-2 text-xs font-bold text-muted">בקשת חיבור</p>
      <div className="grid grid-cols-2 gap-2">
        {platforms.map(({ k, has }) => (
          <PlatformCard
            key={k}
            kind={k}
            has={has}
            name={user.first_name}
            req={requestFor(k)}
            sending={sending === k}
            busy={sending !== null}
            onRequest={() => request(k)}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">הקישור נחשף רק אם {user.first_name} מאשר/ת, תוך שעתיים. אם {user.first_name} יבחר/תבחר לשתף גם את שלו/ה, גם הקישור שלך ייחשף אליו/ה.</p>

      <button onClick={block} className="mx-auto mt-4 block text-xs text-muted underline-offset-2 hover:text-danger hover:underline">
        חסימה (הדדית וקבועה)
      </button>
    </div>
  );
}

/** One "בקשת חיבור" card. Once approved it becomes a direct link to the profile. */
function PlatformCard({
  kind,
  has,
  name,
  req,
  sending,
  busy,
  onRequest,
}: {
  kind: Platform;
  has: boolean;
  name: string;
  req: ConnectionRequest | null;
  sending: boolean;
  busy: boolean;
  onRequest: () => void;
}) {
  const Icon = kind === 'linkedin' ? Linkedin : Instagram;
  const accepted = has && req?.status === 'accepted';
  const { link, state, retry } = useConnectionLink(accepted ? req.id : null);

  if (accepted && link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`פתיחת ה-${kindLabel[kind]} של ${name}`}
        className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-white shadow-md transition-transform active:scale-[0.98] ${
          kind === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
        }`}
      >
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Icon size={16} />
          {kindLabel[kind]}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-white/90">
          <Check size={11} /> אושר · פתיחת הפרופיל <ArrowUpLeft size={11} />
        </span>
      </a>
    );
  }

  const failed = state === 'error';
  return (
    <button
      disabled={!has || busy || (!!req && !failed)}
      onClick={failed ? retry : onRequest}
      className="btn-ghost flex flex-col items-center gap-1 py-3 disabled:opacity-50"
    >
      <span className="flex items-center gap-1.5 text-sm font-bold">
        {sending || state === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} className={kind === 'linkedin' ? 'text-[#0A66C2]' : 'text-[#DD2A7B]'} />
        )}
        {kindLabel[kind]}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted">
        {!has ? (
          'לא קיים'
        ) : failed ? (
          'הטעינה נכשלה · נסו שוב'
        ) : state === 'unavailable' ? (
          'הקישור לא זמין'
        ) : accepted ? (
          <><Check size={11} className="text-live" /> אושר</>
        ) : req ? (
          <><Clock size={11} /> ממתין</>
        ) : (
          'שליחת בקשה'
        )}
      </span>
    </button>
  );
}

function StateCard({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center rounded-3xl px-6 py-8 text-center anim-card">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[300px] text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
