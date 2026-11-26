import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpLeft, Check, Clock, EyeOff, Instagram, Linkedin, Loader2, MapPinOff, MessageCircle, Send, Share2, UserPlus, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { TagChips } from '../components/TagChips';
import { NearbySkeleton } from '../components/Skeleton';
import { IntentBar } from '../components/IntentBar';
import { StudentCard, activityLabel, ctaBase, proximityLabel } from '../components/StudentCard';
import { BottomSheet } from '../components/BottomSheet';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { FEW_PEOPLE, RADIUS_M } from '../hooks/useNearby';
import { toast } from '../lib/notify';
import { intentIcebreaker } from '../lib/intent';
import { matchesFilter, rankNearby, splitTiers, type NearbyFilter, type Ranked } from '../lib/ranking';
import { findRequest, requestFailureText } from '../lib/requests';
import { inviteNearby, kindLabel } from '../lib/social';
import type { GeoStatus } from '../hooks/usePresence';
import type { Inbox } from '../hooks/useInbox';
import type { GroupsData } from '../hooks/useGroups';
import type { ConnectionRequest, NearbyUser, Platform, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  visible: boolean;
  onShow: () => void;
  geo: GeoStatus;
  users: NearbyUser[];
  /** First scan finished (skeleton cards until then). */
  scanned: boolean;
  campusCount: number | null;
  inbox: Inbox;
  groups: GroupsData;
  /** My own live status (null = none / expired) and how to change it. */
  myIntent: string | null;
  onSaveIntent: (value: string | null) => Promise<boolean>;
  onOpenChat: (chatId: string) => void;
}

export function Radar({ myId, visible, onShow, geo, users, scanned, campusCount, inbox, groups, myIntent, onSaveIntent, onOpenChat }: Props) {
  const [selected, setSelected] = useState<NearbyUser | null>(null);
  const [filter, setFilter] = useState<NearbyFilter>('all');

  // people who share at least one of my rooms
  const sharedIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups.groups) for (const m of groups.members[g.id] ?? []) if (m.member_id !== myId) s.add(m.member_id);
    return s;
  }, [groups.groups, groups.members, myId]);
  const ranked = useMemo(() => rankNearby(users, { myIntent, sharedIds }), [users, myIntent, sharedIds]);
  const counts = useMemo(
    () => ({ all: ranked.length, intent: ranked.filter((r) => matchesFilter(r, 'intent')).length, room: ranked.filter((r) => matchesFilter(r, 'room')).length, close: ranked.filter((r) => matchesFilter(r, 'close')).length }),
    [ranked],
  );
  const { spotlight, rest } = useMemo(() => splitTiers(ranked.filter((r) => matchesFilter(r, filter))), [ranked, filter]);
  const live = visible && geo === 'ok';
  const locating = visible && (geo === 'idle' || geo === 'locating');

  return (
    <div className="px-4 pt-4 pb-6">
      <LiveStatusCard live={live} locating={locating} scanned={scanned} nearby={users.length} campusCount={campusCount} />
      {visible && <IntentBar saved={myIntent} onSave={onSaveIntent} />}

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
      ) : geo !== 'ok' || !scanned ? (
        <NearbySkeleton />
      ) : (
        <>
          {users.length > 0 && (
            <>
              {spotlight.length > 0 && (
                <section aria-label="במוקד עכשיו">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                    <span className="h-2 w-2 rounded-full bg-live" /> במוקד עכשיו
                  </h2>
                  <ul className="space-y-3">
                    {spotlight.map((r, i) => (
                      <li key={r.user.id} className="anim-card" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                        {r.shared && (
                          <p className="mb-1 flex w-fit items-center gap-1 rounded-full border border-line bg-card px-2.5 py-0.5 text-[11px] font-bold text-cta-press">
                            <Users size={11} /> חדר משותף
                          </p>
                        )}
                        <NearbyCard user={r.user} myId={myId} inbox={inbox} onOpen={() => setSelected(r.user)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <FilterBar value={filter} onChange={setFilter} counts={counts} />

              {rest.length > 0 && (
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card" aria-label="בקמפוס">
                  {rest.map((r) => (
                    <li key={r.user.id}>
                      <CompactRow ranked={r} onOpen={() => setSelected(r.user)} />
                    </li>
                  ))}
                </ul>
              )}
              {spotlight.length === 0 && rest.length === 0 && (
                <div className="rounded-2xl border border-line bg-card px-4 py-6 text-center">
                  <p className="text-sm font-bold text-ink">אף אחד לא מתאים לסינון הזה</p>
                  <button onClick={() => setFilter('all')} className="btn-ghost mt-3 min-h-[44px] px-5 text-sm font-bold">הצג הכל</button>
                </div>
              )}
              <p className="mt-4 px-3 text-center text-[11px] leading-relaxed text-muted">
                הקישורים נחשפים רק באישור. אם מי שאישר בוחר להחליף, גם הקישור שלך ייחשף אליו.
              </p>
            </>
          )}
          {users.length === 0 && <EmptyRadar campusCount={campusCount} />}
          {users.length > 0 && users.length < FEW_PEOPLE && (
            <button
              onClick={() => void inviteNearby(toast)}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft/60 text-sm font-bold text-cta-press transition-transform active:scale-[0.98]"
            >
              <Share2 size={16} /> הזמן חברים לידך
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

/** The radar header: is this phone discoverable right now, how many people are around, one tap to invite. */
function LiveStatusCard({
  live,
  locating,
  scanned,
  nearby,
  campusCount,
}: {
  live: boolean;
  locating: boolean;
  scanned: boolean;
  nearby: number;
  campusCount: number | null;
}) {
  const num = (n: number) => <span dir="ltr" className="tabular-nums">{n}</span>;
  const title = live ? (
    scanned ? <>פעיל בסביבה · {num(RADIUS_M)} מ׳</> : 'סורקים את הסביבה…'
  ) : locating ? (
    'מאתרים מיקום…'
  ) : (
    'לא פעיל כרגע'
  );
  return (
    <section aria-live="polite" className="card card-elevated mb-4 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {live && <span className="absolute -inset-1.5 rounded-full bg-live/30 anim-ping" />}
          <span className={`relative h-3.5 w-3.5 rounded-full ${live ? 'bg-live shadow-[0_0_0_4px_rgb(16_185_129/0.18)]' : 'bg-muted/40'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-tight font-extrabold text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            {live && scanned ? (
              <>
                <span className="whitespace-nowrap">{nearby > 0 ? <>{num(nearby)} לידך</> : 'אף אחד לא לידך כרגע'}</span>
                {campusCount != null && campusCount > 0 && (
                  <>
                    {' · '}
                    <span className="whitespace-nowrap">{num(campusCount)} קצת יותר רחוק</span>
                  </>
                )}
              </>
            ) : live || locating ? (
              'רגע, מחפשים סטודנטים קרובים'
            ) : (
              'הדליקו ״גלוי בסביבה״ כדי לראות ולהיראות'
            )}
          </p>
        </div>
        {live && (
          <button
            onClick={() => void inviteNearby(toast)}
            aria-label="הזמנת חבר שיושב לידך"
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary-soft px-3 text-sm font-bold text-cta-press transition-transform active:scale-[0.97]"
          >
            <Share2 size={16} />
            הזמן
          </button>
        )}
      </div>
      {live && <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">השאר מיקום פעיל כדי שחברים בקמפוס יראו אותך</p>}
    </section>
  );
}

/** A student in the feed: identity (tap for details) + one clear action. */
const FILTERS: { key: NearbyFilter; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'intent', label: 'עם סטטוס' },
  { key: 'room', label: 'מחדר משותף' },
  { key: 'close', label: 'ממש לידך' },
];

/** One-tap filters: a horizontal row (44px tall hit areas, the visible pill is slimmer). */
function FilterBar({ value, onChange, counts }: { value: NearbyFilter; onChange: (f: NearbyFilter) => void; counts: Record<NearbyFilter, number> }) {
  return (
    <div role="group" aria-label="סינון" className="-mx-4 mt-3 mb-1 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
      {FILTERS.map((f) => {
        const on = value === f.key;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(f.key)}
            className="flex h-11 shrink-0 items-center active:scale-[0.97]"
          >
            <span className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors ${on ? 'border-cta bg-cta text-white' : 'border-line bg-card text-ink/80'}`}>
              {f.label}
              <span dir="ltr" className={`tabular-nums ${on ? 'text-white/80' : 'text-muted'}`}>{counts[f.key]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A scannable row: avatar, name, one line of headline (or their status), proximity. Tap for the full sheet. */
function CompactRow({ ranked, onOpen }: { ranked: Ranked; onOpen: () => void }) {
  const u = ranked.user;
  const line = u.headline?.trim() || 'סטודנט/ית בקמפוס';
  return (
    <button onClick={onOpen} className="flex min-h-[64px] w-full items-center gap-3 px-3 py-2 text-start transition-colors active:bg-bg">
      <Avatar url={u.avatar_url} name={u.first_name} size={44} live={(u.active_minutes ?? 99) <= 10} />
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[15px] leading-snug font-bold text-ink">{u.first_name}</span>
        <span dir="auto" className="block truncate text-[13px] leading-snug text-muted">{line}</span>
      </span>
      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] leading-none font-bold whitespace-nowrap text-cta-press">{proximityLabel(u.distance_m)}</span>
    </button>
  );
}

function NearbyCard({ user, myId, inbox, onOpen }: { user: NearbyUser; myId: string; inbox: Inbox; onOpen: () => void }) {
  return (
    <StudentCard
      name={user.first_name}
      headline={user.headline}
      avatarUrl={user.avatar_url}
      tags={user.tags}
      intent={user.current_intent}
      distanceM={user.distance_m}
      activeMinutes={user.active_minutes}
      live
      onOpen={onOpen}
      cta={<ConnectCta user={user} myId={myId} inbox={inbox} onOpen={onOpen} />}
    />
  );
}

/** LinkedIn when they have one (one tap sends the request, then it becomes the profile link); otherwise opens the sheet. */
function ConnectCta({ user, myId, inbox, onOpen }: { user: NearbyUser; myId: string; inbox: Inbox; onOpen: () => void }) {
  const [sending, setSending] = useState(false);
  const li = user.has_linkedin ? findRequest(inbox.requests, myId, user.id, 'linkedin', Date.now()) : null;
  const { link, state, retry } = useConnectionLink(li && li.status === 'accepted' ? li.id : null);

  const send = async () => {
    setSending(true);
    const { error } = await inbox.sendRequest(user.id, 'linkedin');
    setSending(false);
    if (error) return toast(requestFailureText(error, user.first_name, 'linkedin'), 'error');
    try { navigator.vibrate?.(30); } catch { /* noop */ }
    toast(`בקשת LinkedIn נשלחה ל${user.first_name}`, 'success');
  };

  if (li?.status === 'accepted') {
    if (link) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`פתיחת הפרופיל של ${user.first_name} ב-LinkedIn`}
          className={`${ctaBase} bg-[#0A66C2] text-white active:scale-[0.98]`}
        >
          <Linkedin size={17} />
          פתח ב-LinkedIn
          <ArrowUpLeft size={15} />
        </a>
      );
    }
    if (state === 'error') {
      return (
        <button onClick={retry} className={`${ctaBase} border border-line bg-card text-ink`}>
          הקישור לא נטען · נסו שוב
        </button>
      );
    }
    return (
      <div className={`${ctaBase} bg-bg text-muted`}>
        {state === 'unavailable' ? 'הקישור כבר לא זמין' : <Loader2 size={17} className="animate-spin" />}
      </div>
    );
  }
  if (li) {
    return (
      <div className={`${ctaBase} border border-line bg-bg text-muted`}>
        <Clock size={16} /> בקשת LinkedIn נשלחה · ממתין
      </div>
    );
  }
  if (user.has_linkedin) {
    return (
      <button onClick={send} disabled={sending} className={`${ctaBase} bg-[#0A66C2] text-white active:scale-[0.98] disabled:opacity-60`}>
        {sending ? <Loader2 size={17} className="animate-spin" /> : <Linkedin size={17} />}
        התחבר ב-LinkedIn
      </button>
    );
  }
  return (
    <button onClick={onOpen} className={`${ctaBase} bg-cta text-white active:scale-[0.98]`}>
      <UserPlus size={17} />
      בקש חיבור
    </button>
  );
}

/** Quiet radar rings with a pulse and three empty seats: this is where people will show up. */
function RadarRings() {
  return (
    <svg viewBox="0 0 160 160" className="mx-auto h-40 w-40" aria-hidden focusable="false">
      <circle cx="80" cy="80" r="70" fill="none" stroke="#00AEEF" strokeOpacity=".10" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="50" fill="none" stroke="#00AEEF" strokeOpacity=".18" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="30" fill="none" stroke="#00AEEF" strokeOpacity=".30" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="62" fill="none" stroke="#00AEEF" strokeWidth="2" className="anim-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      <circle cx="118" cy="50" r="9" fill="#fff" stroke="#00AEEF" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="42" cy="104" r="8" fill="#fff" stroke="#00AEEF" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="116" cy="112" r="7" fill="#fff" stroke="#00AEEF" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="80" cy="80" r="10" fill="#0284C7" />
      <circle cx="80" cy="80" r="4" fill="#fff" />
    </svg>
  );
}

/** Nobody within 400m: set the scene, then make inviting one tap (native share sheet on a phone). */
function EmptyRadar({ campusCount }: { campusCount: number | null }) {
  return (
    <div className="card card-elevated rounded-3xl px-5 pt-6 pb-5 text-center anim-card">
      <RadarRings />
      <h3 className="mt-1 text-xl font-extrabold text-ink">אף אחד לא לידך. עדיין.</h3>
      <p className="mx-auto mt-1.5 max-w-[290px] text-sm leading-relaxed text-ink/70">
        היו הראשונים בסביבה. הזמינו את מי שיושב לידכם, ותראו זה את זה כאן ברגע שיצטרף.
      </p>
      {campusCount != null && campusCount > 0 && (
        <p className="mt-2 text-xs text-muted">
          בינתיים, <span dir="ltr" className="font-bold tabular-nums text-ink">{campusCount}</span> פעילים קצת יותר רחוק (עד 2 ק״מ).
        </p>
      )}
      <button onClick={() => void inviteNearby(toast)} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-base">
        <Share2 size={18} />
        הזמן חברים לידך
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

  const requestFor = (k: RequestKind) => findRequest(inbox.requests, myId, user.id, k, now);

  const openChat = inbox.threads.find((t) => t.partnerId === user.id && new Date(t.chat.expires_at).getTime() > now);
  const chatStatus = requestFor('chat')?.status ?? null;

  const request = async (k: RequestKind) => {
    setSending(k);
    const { error } = await inbox.sendRequest(user.id, k, k === 'chat' ? first : undefined);
    setSending(null);
    if (error) {
      toast(requestFailureText(error, user.first_name, k), 'error');
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
        {user.current_intent && (
          <p dir="auto" className="mt-2 max-w-[300px] rounded-xl bg-bg px-3 py-1.5 text-[13px] leading-snug text-ink/80">
            <span className="font-bold text-ink">כרגע: </span>
            {user.current_intent}
          </p>
        )}
        <TagChips tags={user.tags} className="mt-2 justify-center" />
        <p className="mt-1 text-xs font-bold text-primary">{proximityLabel(user.distance_m)}{activityLabel(user.active_minutes) ? ` · ${activityLabel(user.active_minutes)}` : ''}</p>
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
            {user.current_intent && (
              <button
                type="button"
                onClick={() => setFirst(intentIcebreaker(user.current_intent as string))}
                className="w-full rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-start text-[13px] leading-snug font-semibold text-cta-press active:scale-[0.99]"
              >
                {intentIcebreaker(user.current_intent)}
              </button>
            )}
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
