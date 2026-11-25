import { useState } from 'react';
import { Check, Clock, EyeOff, Instagram, Linkedin, Loader2, MessageCircle, UserCheck } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Section } from '../components/Section';
import { useConnectionLink } from '../hooks/useConnectionLink';
import { useNow } from '../hooks/useNow';
import { toast } from '../lib/notify';
import { kindLabel } from '../lib/social';
import { formatCountdown, msLeft } from '../lib/time';
import type { Inbox as InboxData } from '../hooks/useInbox';
import type { ConnectionRequest, Platform, PublicProfile, RequestKind } from '../lib/types';

interface Props {
  myId: string;
  inbox: InboxData;
  /** Which of MY profile links are filled in — decides whether "approve and share mine too" is offered. */
  myLinks: Record<Platform, boolean>;
  onOpenChat: (chatId: string) => void;
}

/** "בקשות": who asked me for something, what I was given, and what I asked for. */
export function RequestsScreen({ myId, inbox, myLinks, onOpenChat }: Props) {
  const now = useNow(1000);
  const { requests, people } = inbox;

  const incoming = requests.filter((r) => r.receiver_id === myId && r.status === 'pending' && msLeft(r.expires_at, now) > 0);
  const sentPending = requests.filter((r) => r.sender_id === myId && r.status === 'pending' && msLeft(r.expires_at, now) > 0);
  const links = requests.filter((r) => r.status === 'accepted' && r.kind !== 'chat');
  const empty = !incoming.length && !sentPending.length && !links.length;

  return (
    <div className="space-y-7 px-4 pt-2 pb-6">
      {empty && (
        <div className="card mt-6 rounded-3xl px-6 py-10 text-center anim-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <UserCheck size={22} />
          </div>
          <h3 className="font-bold text-ink">עוד אין בקשות</h3>
          <p className="mt-1.5 text-sm text-muted">בקשות LinkedIn, Instagram וצ׳אט, וחיבורים שאושרו, יופיעו כאן.</p>
        </div>
      )}

      {incoming.length > 0 && (
        <Section title="ממתינות לאישור שלך" count={incoming.length}>
          {incoming.map((r) => (
            <IncomingCard key={r.id} req={r} person={people[r.sender_id]} now={now} inbox={inbox} myLinks={myLinks} onOpenChat={onOpenChat} />
          ))}
        </Section>
      )}

      {links.length > 0 && (
        <Section title="חיבורים שאושרו" hint="לחצו לפתיחת הפרופיל והוספה ישירה ב-LinkedIn או ב-Instagram">
          {links.map((r) => (
            <LinkCard
              key={r.id}
              req={r}
              myId={myId}
              person={people[r.sender_id === myId ? r.receiver_id : r.sender_id]}
              inbox={inbox}
              now={now}
            />
          ))}
        </Section>
      )}

      {sentPending.length > 0 && (
        <Section title="בקשות שנשלחו">
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

function LinkCard({
  req,
  myId,
  person,
  inbox,
  now,
}: {
  req: ConnectionRequest;
  myId: string;
  person?: PublicProfile;
  inbox: InboxData;
  now: number;
}) {
  const iSent = req.sender_id === myId;
  const [asking, setAsking] = useState(false);
  // Approved requests are one-way. Offer the reverse if I have no live request back for this platform.
  const askedBack = inbox.requests.some(
    (x) =>
      x.sender_id === myId && x.receiver_id === req.sender_id && x.kind === req.kind &&
      (x.status === 'accepted' || (x.status === 'pending' && msLeft(x.expires_at, now) > 0)),
  );
  const askBack = async () => {
    setAsking(true);
    const { error } = await inbox.sendRequest(req.sender_id, req.kind);
    setAsking(false);
    if (error) toast(error.includes('no ') ? `${person?.first_name ?? 'המשתמש'} לא הוסיף/ה ${kindLabel[req.kind]}` : 'לא הצלחנו לשלוח את הבקשה', 'error');
    else toast(`בקשת ${kindLabel[req.kind]} נשלחה ל${person?.first_name ?? ''}`, 'success');
  };
  const { link, state, retry } = useConnectionLink(iSent ? req.id : null);
  const label = kindLabel[req.kind];

  return (
    <li className="card flex flex-wrap items-center gap-3 rounded-2xl p-3">
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
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white ${
              req.kind === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
            }`}
          >
            {req.kind === 'linkedin' ? <Linkedin size={16} /> : <Instagram size={16} />}
            {req.kind === 'linkedin' ? 'פתח פרופיל ב-LinkedIn להוספה ↗' : 'פתח פרופיל ב-Instagram ↗'}
          </a>
        ) : state === 'error' ? (
          <button onClick={retry} className="btn-ghost flex w-full items-center justify-center gap-1.5 py-2 text-sm font-bold text-ink">
            הקישור לא נטען · נסו שוב
          </button>
        ) : state === 'unavailable' ? (
          <p className="w-full rounded-xl bg-bg px-3 py-2 text-center text-xs text-muted">הקישור כבר לא זמין (ייתכן ש{person?.first_name ?? 'המשתמש'} הסיר/ה אותו)</p>
        ) : (
          <Loader2 size={18} className="animate-spin text-muted" />
        ))}
      {!iSent && !askedBack && (
        <button
          onClick={askBack}
          disabled={asking}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${
            req.kind === 'linkedin' ? 'bg-[#0A66C2]' : 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
          }`}
        >
          {asking ? <Loader2 size={16} className="animate-spin" /> : req.kind === 'linkedin' ? <Linkedin size={16} /> : <Instagram size={16} />}
          {`בקש גם את ה-${label} חזרה`}
        </button>
      )}
    </li>
  );
}
