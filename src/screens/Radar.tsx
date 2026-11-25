import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpLeft, Check, Clock, EyeOff, Instagram, Linkedin, Loader2, MapPinOff, MessageCircle, Send, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { CAMPUS_RADIUS_M, FEW_PEOPLE, RADIUS_M } from '../hooks/useNearby';
import { toast } from '../lib/notify';
import { kindLabel, whatsappInviteUrl } from '../lib/social';
import type { GeoStatus } from '../hooks/usePresence';
import type { Inbox } from '../hooks/useInbox';
import type { ConnectionRequest, NearbyUser, Platform, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  visible: boolean;
  onShow: () => void;
  geo: GeoStatus;
  accuracy: number | null;
  users: NearbyUser[];
  campusCount: number | null;
  inbox: Inbox;
  onOpenChat: (chatId: string) => void;
}

/** Stable pseudo-angle per user — decorative only (real bearings are never exposed). */
function angleFor(id: string) {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

export function Radar({ myId, visible, onShow, geo, accuracy, users, campusCount, inbox, onOpenChat }: Props) {
  const [selected, setSelected] = useState<NearbyUser | null>(null);
  const live = visible && geo === 'ok';

  return (
    <div className="px-4 pb-6">
      <RadarScope users={live ? users : []} live={live} onSelect={setSelected} />

      <div className="mt-1 mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-bold text-ink">
          סביבך
          {live && <span className="ms-2 text-sm font-medium text-muted">{users.length} ברדיוס {RADIUS_M} מ׳</span>}
        </h2>
        {live && accuracy != null && (
          <span className={`text-[11px] ${accuracy > 40 ? 'text-danger' : 'text-muted'}`}>דיוק GPS ±{Math.round(accuracy)} מ׳</span>
        )}
      </div>

      {!visible ? (
        <StateCard
          icon={<EyeOff size={24} />}
          title="את/ה מוסתר/ת"
          body="אף אחד לא רואה אותך ברדאר, וגם את/ה לא רואה אחרים. בקשות וצ׳אטים קיימים ממשיכים לעבוד."
          action={<button onClick={onShow} className="btn-primary mt-4 px-6 py-3">להופיע ברדאר</button>}
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
                      <span className="block text-[17px] font-bold text-ink">{u.first_name}</span>
                      {u.headline && <span className="block truncate text-sm text-muted">{u.headline}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">~{u.distance_m} מ׳</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {users.length < FEW_PEOPLE && <FewPeople count={users.length} campusCount={campusCount} />}
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

/** Empty state: fewer than 3 people within 75m → campus-wide count + WhatsApp invite. */
function FewPeople({ count, campusCount }: { count: number; campusCount: number | null }) {
  return (
    <div className={`card rounded-3xl p-5 text-center anim-card ${count > 0 ? 'mt-4' : ''}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-live-soft text-live">
        <Users size={22} />
      </div>
      <h3 className="text-base font-bold text-ink">{count === 0 ? 'שקט כאן כרגע' : 'עוד קצת ומתחילים'}</h3>
      {campusCount != null && campusCount > 0 ? (
        <p className="mt-1.5 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
            <span className="h-2 w-2 rounded-full bg-live anim-live" />
            {campusCount} פעילים עכשיו בקמפוס
          </span>
          <br />
          ברדיוס {CAMPUS_RADIUS_M / 1000} ק״מ ממך
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">עוד אין פעילים בקמפוס. תהיו הראשונים להזמין.</p>
      )}
      <a
        href={whatsappInviteUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-[15px] font-bold text-white shadow-md active:scale-[0.98]"
      >
        <WhatsAppIcon />
        הזמינו את מי שבחדר
      </a>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
    </svg>
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
      toast(error.includes('chat already open') ? 'כבר יש ביניכם צ׳אט פתוח' : 'לא הצלחנו לשלוח את הבקשה', 'error');
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
      <p className="mt-3 text-center text-[11px] text-muted">הקישור נחשף רק אם {user.first_name} מאשר/ת, תוך שעתיים.</p>

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

function RadarScope({ users, live, onSelect }: { users: NearbyUser[]; live: boolean; onSelect: (u: NearbyUser) => void }) {
  const blips = useMemo(
    () =>
      users.slice(0, 24).map((u) => {
        const r = Math.min(1, u.distance_m / RADIUS_M) * 0.86 + 0.08;
        const a = angleFor(u.id);
        return { u, x: 50 + Math.cos(a) * r * 50, y: 50 + Math.sin(a) * r * 50 };
      }),
    [users],
  );

  return (
    <div className="relative mx-auto my-3 aspect-square w-full max-w-[280px]">
      <div className="absolute inset-0 rounded-full border border-primary/20 bg-card shadow-[0_8px_30px_rgb(0_174_239/0.10)]" />
      <div className="absolute inset-[18%] rounded-full border border-primary/15" />
      <div className="absolute inset-[36%] rounded-full border border-primary/20" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-primary/10" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-primary/10" />
      {live && (
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute inset-0 rounded-full anim-sweep"
            style={{ background: 'conic-gradient(from 0deg, rgba(0,174,239,0.22), rgba(0,174,239,0) 70deg, transparent 360deg)' }}
          />
        </div>
      )}
      <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] text-muted">{RADIUS_M} מ׳</span>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {live && <span className="absolute -inset-4 rounded-full border border-live/60 anim-ping" />}
        <span className={`block h-4 w-4 rounded-full border-2 border-white shadow ${live ? 'bg-live' : 'bg-muted/50'}`} />
      </div>

      {blips.map(({ u, x, y }) => (
        <button
          key={u.id}
          onClick={() => onSelect(u)}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md transition-all duration-700"
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-label={`${u.first_name}, ${u.distance_m} מטר`}
        >
          <Avatar url={u.avatar_url} name={u.first_name} size={34} />
        </button>
      ))}
    </div>
  );
}
