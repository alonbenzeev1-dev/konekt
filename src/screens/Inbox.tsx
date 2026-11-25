import { useState, type ReactNode } from 'react';
import { ArrowUpLeft, Check, Clock, EyeOff, Hourglass, Instagram, Linkedin, Loader2, MessageCircle } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { useNow } from '../hooks/useNow';
import { toast } from '../lib/notify';
import { kindLabel } from '../lib/social';
import { formatClock, formatCountdown, formatHoursLeft, msLeft } from '../lib/time';
import type { Inbox as InboxData } from '../hooks/useInbox';
import type { ConnectionRequest, PublicProfile, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  inbox: InboxData;
  onOpenChat: (chatId: string) => void;
}

export function Inbox({ myId, inbox, onOpenChat }: Props) {
  const now = useNow(1000);
  const { requests, threads, people } = inbox;

  const incoming = requests.filter((r) => r.receiver_id === myId && r.status === 'pending' && msLeft(r.expires_at, now) > 0);
  const sentPending = requests.filter((r) => r.sender_id === myId && r.status === 'pending' && msLeft(r.expires_at, now) > 0);
  const links = requests.filter((r) => r.status === 'accepted' && r.kind !== 'chat');
  const liveThreads = threads.filter((t) => msLeft(t.chat.expires_at, now) > 0);
  const empty = !incoming.length && !sentPending.length && !links.length && !liveThreads.length;

  return (
    <div className="space-y-7 px-4 pt-2 pb-6">
      {empty && (
        <div className="card mt-6 rounded-3xl px-6 py-10 text-center anim-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MessageCircle size={22} />
          </div>
          <h3 className="font-bold text-ink">עוד אין כאן כלום</h3>
          <p className="mt-1.5 text-sm text-muted">בקשות, חיבורים וצ׳אטים יופיעו כאן. צ׳אט שאושר נמחק אוטומטית אחרי 24 שעות.</p>
        </div>
      )}

      {incoming.length > 0 && (
        <Section title="בקשות ממתינות" count={incoming.length}>
          {incoming.map((r) => (
            <IncomingCard key={r.id} req={r} person={people[r.sender_id]} now={now} inbox={inbox} onOpenChat={onOpenChat} />
          ))}
        </Section>
      )}

      {liveThreads.length > 0 && (
        <Section title="צ׳אטים פעילים">
          {liveThreads.map((t) => {
            const p = people[t.partnerId];
            const mine = t.last?.sender_id === myId;
            return (
              <li key={t.chat.id}>
                <button
                  onClick={() => onOpenChat(t.chat.id)}
                  className="card flex w-full items-center gap-3 rounded-2xl p-3 text-start transition-transform active:scale-[0.985]"
                >
                  <Avatar url={p?.avatar_url ?? null} name={p?.first_name ?? '…'} size={50} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-ink">{p?.first_name ?? '…'}</span>
                      {t.last && <span className="shrink-0 text-[11px] text-muted">{formatClock(t.last.created_at)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${t.unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                        {t.last ? `${mine ? 'את/ה: ' : ''}${t.last.content}` : 'הצ׳אט נפתח'}
                      </span>
                      {t.unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-cta px-1.5 text-[11px] font-bold leading-5 text-white">{t.unread}</span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                          <Hourglass size={10} />
                          {formatHoursLeft(msLeft(t.chat.expires_at, now))}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </Section>
      )}

      {links.length > 0 && (
        <Section title="חיבורים שאושרו">
          {links.map((r) => (
            <LinkCard key={r.id} req={r} myId={myId} person={people[r.sender_id === myId ? r.receiver_id : r.sender_id]} />
          ))}
        </Section>
      )}

      {sentPending.length > 0 && (
        <Section title="בקשות ששלחתי">
          {sentPending.map((r) => {
            const p = people[r.receiver_id];
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card/60 px-3 py-2.5">
                <Avatar url={p?.avatar_url ?? null} name={p?.first_name ?? '…'} size={38} />
                <span className="flex flex-1 items-center gap-1.5 text-sm text-ink">
                  <KindIcon k={r.kind} />
                  {kindLabel[r.kind]} · {p?.first_name ?? '…'}
                </span>
                <span className="flex items-center gap-1 text-xs tabular-nums text-muted" dir="ltr">
                  <Clock size={12} />
                  {formatCountdown(msLeft(r.expires_at, now))}
                </span>
              </li>
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-bold text-ink">
        {title}
        {count != null && <span className="rounded-full bg-cta px-2 text-xs text-white">{count}</span>}
      </h2>
      <ul className="space-y-2.5">{children}</ul>
    </section>
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
  onOpenChat,
}: {
  req: ConnectionRequest;
  person?: PublicProfile;
  now: number;
  inbox: InboxData;
  onOpenChat: (chatId: string) => void;
}) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const left = msLeft(req.expires_at, now);
  const pct = Math.max(0, Math.min(100, (left / (2 * 3600_000)) * 100));
  const name = person?.first_name ?? '…';

  const approve = async () => {
    setBusy('yes');
    const { error, chatId } = await inbox.respond(req.id);
    setBusy(null);
    if (error) return toast('הבקשה כבר לא בתוקף', 'error');
    if (req.kind === 'chat') {
      toast(`הצ׳אט עם ${name} פתוח ל-24 שעות`, 'success');
      if (chatId) onOpenChat(chatId);
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

  const what =
    req.kind === 'chat' ? 'רוצה להתחיל איתך צ׳אט' : `מבקש/ת את ה-${kindLabel[req.kind]} שלך`;

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
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <button onClick={approve} disabled={!!busy} className="btn-primary flex items-center justify-center gap-1.5 py-2.5 text-sm">
          {busy === 'yes' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          אשר
        </button>
        <button onClick={ignoreBlock} disabled={!!busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted">
          {busy === 'no' ? <Loader2 size={16} className="animate-spin" /> : <EyeOff size={16} />}
          התעלם / חסום
        </button>
      </div>
      <div className="h-1 bg-bg">
        <div className="h-full bg-primary transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function LinkCard({ req, myId, person }: { req: ConnectionRequest; myId: string; person?: PublicProfile }) {
  const iSent = req.sender_id === myId;
  const { link, state } = useConnectionLink(iSent ? req.id : null);

  if (iSent && (state === 'unavailable' || state === 'error')) return null;
  const label = kindLabel[req.kind];

  return (
    <li className="card flex items-center gap-3 rounded-2xl p-3">
      <Avatar url={person?.avatar_url ?? null} name={person?.first_name ?? '…'} size={48} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{person?.first_name ?? '…'}</p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Check size={12} className="text-live" />
          {iSent ? `אישר/ה את בקשת ה-${label}` : `קיבל/ה את ה-${label} שלך`}
        </p>
      </div>
      {iSent &&
        (link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white ${
              req.kind === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
            }`}
          >
            {req.kind === 'linkedin' ? <Linkedin size={15} /> : <Instagram size={15} />}
            <span className="sr-only">{label}</span>
            פתח
            <ArrowUpLeft size={14} />
          </a>
        ) : (
          <Loader2 size={18} className="animate-spin text-muted" />
        ))}
    </li>
  );
}
