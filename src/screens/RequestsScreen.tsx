import { useMemo, useState } from 'react';
import { Check, Clock, EyeOff, History, Instagram, Linkedin, Loader2, MessageCircle, RotateCcw, UserCheck } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Section } from '../components/Section';
import { Segmented } from '../components/Segmented';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { useNow } from '../hooks/useNow';
import { toast } from '../lib/notify';
import {
  activeConnections,
  activeUntil,
  findRequest,
  historyItems,
  pendingSplit,
  requestFailureText,
  type ConnectionEntry,
  type HistoryItem,
  type PersonConnection,
} from '../lib/requests';
import { kindLabel } from '../lib/social';
import { PushPromptBanner } from '../components/PushCard';
import { formatCountdown, formatHoursLeft, formatWhen, msLeft } from '../lib/time';
import type { Inbox as InboxData } from '../hooks/useInbox';
import type { ConnectionRequest, NearbyUser, Platform, PublicProfile, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  inbox: InboxData;
  /** Which of MY profile links are filled in — decides whether "approve and share mine too" is offered. */
  myLinks: Record<Platform, boolean>;
  /** People near me right now: "בקש שוב" in the history only makes sense for them. */
  nearby: NearbyUser[];
  onOpenChat: (chatId: string) => void;
}

type View = 'pending' | 'active' | 'history';

/** "בקשות": what needs me (2 h), who I am connected to (48 h), and what already lapsed. One card per person. */
export function RequestsScreen({ myId, inbox, myLinks, nearby, onOpenChat }: Props) {
  const now = useNow(1000);
  const { requests, people } = inbox;

  const { incoming, outgoing } = useMemo(() => pendingSplit(requests, myId, now), [requests, myId, now]);
  const connections = useMemo(() => activeConnections(requests, myId, now), [requests, myId, now]);
  const history = useMemo(() => historyItems(requests, myId, now), [requests, myId, now]);

  // open on the view that has something for me
  const [view, setView] = useState<View>(() => (incoming.length > 0 || connections.length === 0 ? 'pending' : 'active'));

  return (
    <div className="space-y-5 px-4 pt-2 pb-6">
      <PushPromptBanner userId={myId} hasRequests={requests.length > 0} />
      <Segmented
        label="סינון בקשות"
        fit="content"
        value={view}
        onChange={setView}
        options={[
          { id: 'pending', label: 'ממתינות', badge: incoming.length },
          { id: 'active', label: 'חיבורים פעילים' },
          { id: 'history', label: 'היסטוריה' },
        ]}
      />

      {view === 'pending' && (
        <>
          {incoming.length === 0 && outgoing.length === 0 && (
            <Empty icon={<UserCheck size={22} />} title="אין בקשות ממתינות" body="בקשות LinkedIn, Instagram וצ׳אט מחכות כאן שעתיים, ואז פגות. אישרתם? הקישור עובר ל״חיבורים פעילים״." />
          )}
          {incoming.length > 0 && (
            <Section title="ממתינות לאישור שלך" count={incoming.length}>
              {incoming.map((r) => (
                <IncomingCard key={r.id} req={r} person={people[r.sender_id]} now={now} inbox={inbox} myLinks={myLinks} onOpenChat={onOpenChat} />
              ))}
            </Section>
          )}
          {outgoing.length > 0 && (
            <Section title="ממתינות לתשובה" hint="בקשות ששלחתם. אם לא יענו תוך שעתיים הן פגות.">
              {outgoing.map((r) => {
                const p = people[r.receiver_id];
                return (
                  <li key={r.id} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-card/70 px-3 py-2.5">
                    <Avatar url={p?.avatar_url ?? null} name={p?.first_name ?? '…'} size={38} />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink">
                      <KindIcon k={r.kind} />
                      <span dir="auto" className="truncate">{kindLabel[r.kind]} · {p?.first_name ?? '…'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted tabular-nums" dir="ltr">
                      <Clock size={12} />
                      {formatCountdown(msLeft(r.expires_at, now))}
                    </span>
                  </li>
                );
              })}
            </Section>
          )}
        </>
      )}

      {view === 'active' &&
        (connections.length === 0 ? (
          <Empty icon={<Linkedin size={22} />} title="אין חיבורים פעילים" body="אחרי שמישהו מאשר, הקישור לפרופיל שלו נפתח כאן ל-48 שעות. ואז אפשר להתחבר ישירות ב-LinkedIn." />
        ) : (
          <Section title="חיבורים פעילים" hint="לחצו לפתיחת הפרופיל והוספה ישירה ב-LinkedIn או ב-Instagram">
            {connections.map((c) => (
              <ConnectionCard key={c.personId} conn={c} person={people[c.personId]} myId={myId} inbox={inbox} now={now} />
            ))}
          </Section>
        ))}

      {view === 'history' &&
        (history.length === 0 ? (
          <Empty icon={<History size={22} />} title="ההיסטוריה ריקה" body="בקשות שפגו וחיבורים שנסגרו אחרי 48 שעות יופיעו כאן, עם אפשרות לבקש שוב כשהאדם לידכם." />
        ) : (
          <Section title="בקשות וחיבורים שהסתיימו" hint="נשמרים כאן כמה ימים">
            {history.map((h) => (
              <HistoryRow key={h.key} item={h} person={people[h.personId]} nearbyUser={nearby.find((u) => u.id === h.personId)} inbox={inbox} myId={myId} now={now} />
            ))}
          </Section>
        ))}
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card rounded-3xl px-6 py-10 text-center anim-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-cta">{icon}</div>
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[290px] text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

const brandFill = (k: Platform) => (k === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]');

/** One row of a person card: the link I can open (they approved me), or the one I gave them (offer to ask back). */
function ConnectionRow({ kind, entry, person, myId, inbox, now }: { kind: Platform; entry: ConnectionEntry; person?: PublicProfile; myId: string; inbox: InboxData; now: number }) {
  const [asking, setAsking] = useState(false);
  const { link, state, retry } = useConnectionLink(entry.sent ? entry.sent.id : null);
  const label = kindLabel[kind];
  const name = person?.first_name ?? 'המשתמש';
  const personId = entry.sent?.receiver_id ?? entry.received?.sender_id ?? '';
  const askedBack = !!findRequest(inbox.requests, myId, personId, kind, now);

  const askBack = async () => {
    setAsking(true);
    const { error } = await inbox.sendRequest(personId, kind);
    setAsking(false);
    if (error) toast(requestFailureText(error, name, kind), 'error');
    else toast(`בקשת ${label} נשלחה ל${name}`, 'success');
  };

  return (
    <div>
      {entry.sent ? (
        link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-white active:scale-[0.98] ${brandFill(kind)}`}
          >
            {kind === 'linkedin' ? <Linkedin size={16} /> : <Instagram size={16} />}
            {kind === 'linkedin' ? 'פתח פרופיל ב-LinkedIn להוספה ↗' : 'פתח פרופיל ב-Instagram ↗'}
          </a>
        ) : state === 'error' ? (
          <button onClick={retry} className="btn-ghost flex w-full items-center justify-center gap-1.5 text-sm font-bold text-ink">
            הקישור לא נטען · נסו שוב
          </button>
        ) : state === 'unavailable' ? (
          <p className="rounded-xl bg-bg px-3 py-2.5 text-center text-xs text-muted">הקישור כבר לא זמין (ייתכן ש{name} הסיר/ה אותו)</p>
        ) : (
          <div className="flex min-h-[44px] items-center justify-center rounded-xl bg-bg">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2">
          <span className="min-w-0 flex-1 text-xs text-ink/70">
            <Check size={12} className="me-1 inline text-live" />
            {name} קיבל/ה את <span className="whitespace-nowrap">ה-{label}</span> שלך
          </span>
          {askedBack ? (
            <span className="flex items-center gap-1 text-xs font-bold text-muted"><Clock size={12} /> ביקשת חזרה</span>
          ) : (
            <button
              onClick={askBack}
              disabled={asking}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-60 ${brandFill(kind)}`}
            >
              {asking ? <Loader2 size={14} className="animate-spin" /> : kind === 'linkedin' ? <Linkedin size={14} /> : <Instagram size={14} />}
              בקש חזרה
            </button>
          )}
        </div>
      )}
      {entry.sent && entry.received && <p className="mt-1 px-1 text-[11px] text-muted"><Check size={11} className="me-1 inline text-live" />החלפתם קישורים</p>}
    </div>
  );
}

/** One card per person, however many approvals there are between you (both directions, both platforms). */
function ConnectionCard({ conn, person, myId, inbox, now }: { conn: PersonConnection; person?: PublicProfile; myId: string; inbox: InboxData; now: number }) {
  const kinds = (['linkedin', 'instagram'] as Platform[]).filter((k) => conn.kinds[k]);
  // the window that closes first is the one that matters
  const until = Math.min(...kinds.map((k) => activeUntil((conn.kinds[k]!.sent ?? conn.kinds[k]!.received) as ConnectionRequest)));
  return (
    <li className="card rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <Avatar url={person?.avatar_url ?? null} name={person?.first_name ?? '…'} size={48} />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-right font-bold text-ink">{person?.first_name ?? '…'}</p>
          {person?.headline && <p dir="auto" className="line-clamp-1 text-right text-xs text-ink/70">{person.headline}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-bg px-2 py-1 text-[11px] font-medium text-muted tabular-nums">{formatHoursLeft(Math.max(0, until - now))}</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {kinds.map((k) => (
          <ConnectionRow key={k} kind={k} entry={conn.kinds[k]!} person={person} myId={myId} inbox={inbox} now={now} />
        ))}
      </div>
    </li>
  );
}

/** An expired request or a closed connection, with a quick "ask again" when the person is nearby. */
function HistoryRow({ item, person, nearbyUser, inbox, myId, now }: { item: HistoryItem; person?: PublicProfile; nearbyUser?: NearbyUser; inbox: InboxData; myId: string; now: number }) {
  const [asking, setAsking] = useState(false);
  const name = person?.first_name ?? '…';
  const kind = item.kind;
  const hasLink = kind === 'linkedin' ? nearbyUser?.has_linkedin : kind === 'instagram' ? nearbyUser?.has_instagram : false;
  const alreadyAsked = kind !== 'chat' && !!findRequest(inbox.requests, myId, item.personId, kind, now);
  const canAsk = item.canRetry && !!nearbyUser && !!hasLink && !alreadyAsked;

  const text =
    item.outcome === 'ended'
      ? item.direction === 'sent'
        ? `הקישור של ${name} היה פתוח 48 שעות`
        : `${name} קיבל/ה את הקישור שלך ל-48 שעות`
      : item.direction === 'sent'
        ? `הבקשה שלך ל${name} לא נענתה`
        : `לא ענית לבקשה של ${name}`;

  const again = async () => {
    if (kind === 'chat') return;
    setAsking(true);
    const { error } = await inbox.sendRequest(item.personId, kind);
    setAsking(false);
    if (error) toast(requestFailureText(error, name, kind), 'error');
    else toast(`בקשת ${kindLabel[kind]} נשלחה ל${name}`, 'success');
  };

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card/70 px-3 py-2.5">
      <Avatar url={person?.avatar_url ?? null} name={name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <KindIcon k={kind} />
          <span dir="auto" className="truncate">{kindLabel[kind]} · {name}</span>
        </p>
        <p dir="auto" className="text-xs leading-snug text-ink/70">{text}</p>
        <p className="mt-0.5 text-[11px] text-muted tabular-nums">{formatWhen(item.at, now)}</p>
      </div>
      {canAsk ? (
        <button
          onClick={again}
          disabled={asking}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary-soft px-3 text-xs font-bold text-cta-press active:scale-[0.97] disabled:opacity-60"
        >
          {asking ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          בקש שוב
        </button>
      ) : item.canRetry && !alreadyAsked ? (
        <span className="max-w-[64px] shrink-0 text-center text-[10px] leading-tight text-muted">לא לידך כרגע</span>
      ) : null}
    </li>
  );
}

function KindIcon({ k, size = 14 }: { k: RequestKind; size?: number }) {
  if (k === 'linkedin') return <Linkedin size={size} className="text-[#0A66C2]" />;
  if (k === 'instagram') return <Instagram size={size} className="text-[#DD2A7B]" />;
  return <MessageCircle size={size} className="text-primary" />;
}

function IncomingCard({
  req,
  person,
  now,
  inbox,
  myLinks,
  onOpenChat,
}: {
  req: ConnectionRequest;
  person?: PublicProfile;
  now: number;
  inbox: InboxData;
  myLinks: Record<Platform, boolean>;
  onOpenChat: (chatId: string) => void;
}) {
  const [busy, setBusy] = useState<'both' | 'yes' | 'no' | null>(null);
  const left = msLeft(req.expires_at, now);
  const pct = Math.max(0, Math.min(100, (left / (2 * 3600_000)) * 100));
  const name = person?.first_name ?? '…';

  // links can be approved one-way, or as an exchange (needs a link of mine for the same platform)
  const canExchange = req.kind !== 'chat' && myLinks[req.kind];

  const approve = async (shareBack: boolean) => {
    setBusy(shareBack ? 'both' : 'yes');
    const { error, chatId, mutual, exchangeUnavailable } = await inbox.respond(req.id, shareBack);
    setBusy(null);
    if (error) {
      return toast(error.includes('already handled') ? 'הבקשה כבר לא בתוקף' : 'לא הצלחנו לאשר. בדקו חיבור ונסו שוב.', 'error');
    }
    if (req.kind === 'chat') {
      toast(`הצ׳אט עם ${name} פתוח ל-24 שעות`, 'success');
      if (chatId) onOpenChat(chatId);
    } else if (exchangeUnavailable) {
      toast(`${name} יכול/ה עכשיו לראות את ה-${kindLabel[req.kind]} שלך. השיתוף ההדדי עוד לא פעיל. אפשר לבקש חזרה.`, 'info');
    } else if (mutual) {
      toast(`שיתפתם זה עם זה. אפשר לפתוח את ה-${kindLabel[req.kind]} של ${name} ב״חיבורים שאושרו״`, 'success');
    } else {
      toast(`${name} יכול/ה עכשיו לראות את ה-${kindLabel[req.kind]} שלך`, 'success');
    }
  };

  const ignoreBlock = async () => {
    setBusy('no');
    const { error } = await inbox.block(req.sender_id);
    setBusy(null);
    if (error) toast('לא הצלחנו להסתיר', 'error');
    else toast(`${name} הוסתר/ה. לא תראו זה את זה יותר.`, 'info');
  };

  // "ה-LinkedIn" must not break after the hyphen (the Latin word would wrap away from its prefix)
  const what =
    req.kind === 'chat' ? 'רוצה להתחיל איתך צ׳אט' : (
      <>
        מבקש/ת את <span className="whitespace-nowrap">ה-{kindLabel[req.kind]}</span> שלך
      </>
    );

  return (
    <li className="card overflow-hidden rounded-2xl anim-card">
      <div className="flex items-center gap-3 p-3">
        <Avatar url={person?.avatar_url ?? null} name={name} size={52} ring />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{name}</p>
          {person?.headline && <p className="truncate text-xs text-muted">{person.headline}</p>}
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/80">
            <KindIcon k={req.kind} />
            {what}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold tabular-nums text-primary" dir="ltr">
          <Clock size={12} />
          {formatCountdown(left)}
        </span>
      </div>
      {req.kind === 'chat' && req.message && (
        <div className="mx-3 mb-3 rounded-2xl rounded-ss-md bg-bg px-3.5 py-2.5 text-[15px] leading-snug text-ink">{req.message}</div>
      )}
      {canExchange ? (
        <div className="space-y-2 px-3 pb-3">
          <button onClick={() => approve(true)} disabled={!!busy} className="btn-primary flex w-full items-center justify-center gap-1.5 py-2.5 text-sm">
            {busy === 'both' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            אשר ושתף גם את שלי
          </button>
          <p className="px-1 text-center text-[11px] leading-snug text-muted">גם {name} ישתף את הקישור, ושניכם תוכלו לפתוח אחד לשני את הפרופיל</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => approve(false)} disabled={!!busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2 text-sm text-ink">
              {busy === 'yes' && <Loader2 size={15} className="animate-spin" />}
              אשר בלבד
            </button>
            <button onClick={ignoreBlock} disabled={!!busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2 text-sm text-muted">
              {busy === 'no' ? <Loader2 size={15} className="animate-spin" /> : <EyeOff size={15} />}
              התעלם / חסום
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <button onClick={() => approve(false)} disabled={!!busy} className="btn-primary flex items-center justify-center gap-1.5 py-2.5 text-sm">
            {busy === 'yes' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            אשר
          </button>
          <button onClick={ignoreBlock} disabled={!!busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted">
            {busy === 'no' ? <Loader2 size={16} className="animate-spin" /> : <EyeOff size={16} />}
            התעלם / חסום
          </button>
        </div>
      )}
      <div className="h-1 bg-bg">
        <div className="h-full bg-primary transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
