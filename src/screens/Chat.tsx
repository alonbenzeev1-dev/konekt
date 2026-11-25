import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Ban, Hourglass, SendHorizontal } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNow } from '../hooks/useNow';
import { toast } from '../lib/notify';
import { formatClock, formatHoursLeft, msLeft } from '../lib/time';
import type { Inbox } from '../hooks/useInbox';

interface Props {
  myId: string;
  chatId: string;
  inbox: Inbox;
  onBack: () => void;
}

const ICEBREAKERS = ['היי! גם אתה בהרצאה עכשיו?', 'ראיתי אותך ברדאר, בא לך קפה בהפסקה?', 'נעים להכיר! באיזה חוג ושנה אתה?'];

export function Chat({ myId, chatId, inbox, onBack }: Props) {
  const now = useNow(30_000);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = inbox.threads.find((t) => t.chat.id === chatId);
  const open = !!thread && msLeft(thread.chat.expires_at, now) > 0;
  const partner = thread ? inbox.people[thread.partnerId] : undefined;
  const name = partner?.first_name ?? '…';

  const msgs = useMemo(() => inbox.messages.filter((m) => m.chat_id === chatId), [inbox.messages, chatId]);

  const { markRead } = inbox;
  useEffect(() => {
    markRead(chatId);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, chatId, markRead]);

  // Android back button / swipe closes the chat instead of leaving the app.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    history.pushState({ chat: chatId }, '');
    const onPop = () => onBackRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [chatId]);

  const sendText = async (v: string) => {
    if (!v || sending || !open) return;
    setSending(true);
    const { error } = await inbox.sendMessage(chatId, v);
    setSending(false);
    if (error) toast('ההודעה לא נשלחה — ייתכן שהצ׳אט נסגר', 'error');
    else if (v === text.trim()) setText('');
  };
  const send = () => sendText(text.trim());

  const block = async () => {
    if (!thread || !window.confirm(`לחסום את ${name}? הצ׳אט יימחק ולא תראו זה את זה יותר.`)) return;
    const { error } = await inbox.block(thread.partnerId);
    if (error) return toast('לא הצלחנו לחסום', 'error');
    toast(`${name} נחסם/ה`, 'info');
    history.back();
  };

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg anim-fade">
      <header className="flex items-center gap-3 border-b border-line bg-card px-3 pb-3 safe-top">
        <button onClick={() => history.back()} className="rounded-full p-2 text-ink active:bg-bg" aria-label="חזרה">
          <ArrowRight size={22} />
        </button>
        <Avatar url={partner?.avatar_url ?? null} name={name} size={40} live={open} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{name}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted">
            <Hourglass size={10} />
            {open && thread ? `צ׳אט זמני · נמחק ${formatHoursLeft(msLeft(thread.chat.expires_at, now))}` : 'הצ׳אט נסגר'}
          </p>
        </div>
        {open && (
          <button onClick={block} className="rounded-full p-2 text-muted active:bg-bg" aria-label="חסימה">
            <Ban size={19} />
          </button>
        )}
      </header>

      <main className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <p className="mx-auto mb-3 w-fit rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted shadow-sm">
          🔒 שניכם אישרתם · הצ׳אט נמחק אוטומטית 24 שעות אחרי שנפתח
        </p>
        {msgs.map((m, i) => {
          const mine = m.sender_id === myId;
          const grouped = msgs[i - 1]?.sender_id === m.sender_id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'pt-2'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                  mine ? 'rounded-se-md bg-cta text-white' : 'rounded-ss-md bg-card text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/80' : 'text-muted'}`}>{formatClock(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        {!open && (
          <p className="pt-6 text-center text-sm text-muted">הצ׳אט הזה כבר לא זמין.</p>
        )}
        <div ref={endRef} />
      </main>

      {open && msgs.length === 0 && (
        <div className="border-t border-line bg-card px-3 pt-2.5">
          <p className="mb-1.5 text-[11px] font-bold text-muted">פתיחה בקליק אחד</p>
          <div className="flex flex-wrap gap-1.5">
            {ICEBREAKERS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={sending}
                onClick={() => void sendText(m)}
                className="rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-start text-[13px] font-semibold text-primary transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className={`flex items-end gap-2 bg-card px-3 pt-2.5 safe-bottom ${open && msgs.length === 0 ? '' : 'border-t border-line'}`}
      >
        <textarea
          rows={1}
          value={text}
          maxLength={1000}
          disabled={!open}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={open ? 'כתבו הודעה…' : 'הצ׳אט נסגר'}
          className="field max-h-32 min-h-[46px] flex-1 resize-none !rounded-3xl !bg-bg !py-2.5"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending || !open}
          className="btn-primary mb-0.5 flex h-[46px] w-[46px] shrink-0 items-center justify-center !rounded-full"
          aria-label="שליחה"
        >
          <SendHorizontal size={19} className="-scale-x-100" />
        </button>
      </form>
    </div>
  );
}
