import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Ban, Hourglass, SendHorizontal, Smile } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { EmojiPicker, insertAtCursor } from '../components/EmojiPicker';
import { MessageActions } from '../components/MessageActions';
import { Openable } from '../components/Openable';
import { ReactionPills } from '../components/ReactionPills';
import { useNow } from '../hooks/useNow';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { useTyping } from '../hooks/useTyping';
import { intentIcebreaker } from '../lib/intent';
import { toast } from '../lib/notify';
import { directKey, reactionPills } from '../lib/reactions';
import { formatClock, formatHoursLeft, msLeft } from '../lib/time';
import type { Inbox } from '../hooks/useInbox';
import type { Message } from '../lib/types';

interface Props {
  myId: string;
  chatId: string;
  inbox: Inbox;
  onBack: () => void;
}

const ICEBREAKERS = ['היי! גם אתה בהרצאה עכשיו?', 'ראיתי אותך בסביבה, בא לך קפה בהפסקה?', 'נעים להכיר! באיזה חוג ושנה אתה?'];

export function Chat({ myId, chatId, inbox, onBack }: Props) {
  const now = useNow(30_000);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [actionFor, setActionFor] = useState<Message | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = inbox.threads.find((t) => t.chat.id === chatId);
  const open = !!thread && msLeft(thread.chat.expires_at, now) > 0;
  const partner = thread ? inbox.people[thread.partnerId] : undefined;
  const name = partner?.first_name ?? '…';

  const msgs = useMemo(() => inbox.messages.filter((m) => m.chat_id === chatId), [inbox.messages, chatId]);
  const { mainRef, endRef, onScroll, unseen, jump } = useStickToBottom(msgs.length, msgs[msgs.length - 1]?.sender_id === myId);

  const typing = useTyping(thread ? `chat:${chatId}` : null, myId);
  const lastFrom = msgs[msgs.length - 1]?.sender_id;
  const { clear: clearTyping } = typing;
  useEffect(() => {
    if (lastFrom && lastFrom !== myId) clearTyping(lastFrom); // their message arrived: they are done typing
  }, [msgs.length, lastFrom, myId, clearTyping]);
  const partnerTyping = open && !!thread && typing.typers.includes(thread.partnerId);

  // what they wrote as their status: a natural first line, offered until I have said something myself
  const partnerIntent = partner?.current_intent?.trim() || null;
  const iHaveWritten = msgs.some((m) => m.sender_id === myId);
  const intentChip = open && partnerIntent && !iHaveWritten ? intentIcebreaker(partnerIntent) : null;

  const { markRead } = inbox;
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(chatId); // a message that arrives while I'm looking at it
  }, [msgs.length, chatId, markRead]);

  // coming back to the app with this chat open
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') markRead(chatId); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [chatId, markRead]);

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

  /** Emoji goes where the caret is, the field keeps focus, the caret lands after it. */
  const pickEmoji = (emoji: string) => {
    const { next, caret } = insertAtCursor(inputRef.current, text, emoji, 1000);
    setText(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const react = async (messageId: string, emoji: string) => {
    const { error } = await inbox.react(messageId, emoji);
    if (error) toast('התגובה לא נשלחה', 'error');
  };

  const block = async () => {
    if (!thread || !window.confirm(`לחסום את ${name}? הצ׳אט יימחק ולא תראו זה את זה יותר.`)) return;
    const { error } = await inbox.block(thread.partnerId);
    if (error) return toast('לא הצלחנו לחסום', 'error');
    toast(`${name} נחסם/ה`, 'info');
    history.back();
  };

  const panelAbove = emojiOpen && open;
  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg anim-fade">
      <header className="flex items-center gap-3 border-b border-line bg-card px-3 pb-3 safe-top">
        <button onClick={() => history.back()} className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-bg" aria-label="חזרה">
          <ArrowRight size={22} />
        </button>
        <Avatar url={partner?.avatar_url ?? null} name={name} size={40} live={open} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{name}</p>
          {partnerTyping ? (
            <p role="status" className="text-[11px] font-bold text-cta-press motion-safe:animate-pulse">מקליד/ה…</p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-muted">
              <Hourglass size={10} />
              {open && thread ? `צ׳אט זמני · נמחק ${formatHoursLeft(msLeft(thread.chat.expires_at, now))}` : 'הצ׳אט נסגר'}
            </p>
          )}
        </div>
        {open && (
          <button onClick={block} className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-bg" aria-label="חסימה">
            <Ban size={19} />
          </button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <main ref={mainRef} onScroll={onScroll} className="flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4">
          <p className="mx-auto mb-3 w-fit rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted shadow-sm">
            🔒 שניכם אישרתם · הצ׳אט נמחק אוטומטית 24 שעות אחרי שנפתח
          </p>
          {msgs.map((m, i) => {
            const mine = m.sender_id === myId;
            const grouped = msgs[i - 1]?.sender_id === m.sender_id;
            const pills = reactionPills(inbox.reactions[directKey(m.id)], myId);
            return (
              <div key={m.id} id={`dm-${m.id}`} className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'} ${grouped ? '' : 'pt-2'}`}>
                <Openable
                  onOpen={() => setActionFor(m)}
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                    mine ? 'rounded-se-md bg-cta text-white' : 'rounded-ss-md bg-card text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-0.5 text-[10px] tabular-nums ${mine ? 'text-white/80' : 'text-muted'}`}>{formatClock(m.created_at)}</p>
                </Openable>
                <ReactionPills pills={pills} mine={mine} onToggle={(e) => void react(m.id, e)} />
              </div>
            );
          })}
          {!open && <p className="pt-6 text-center text-sm text-muted">הצ׳אט הזה כבר לא זמין.</p>}
          <div ref={endRef} />
        </main>

        {unseen > 0 && (
          <button
            onClick={jump}
            className="absolute bottom-3 left-1/2 flex min-h-[44px] -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-bold text-cta-press shadow-md active:scale-[0.97]"
          >
            <ArrowDown size={16} /> {unseen === 1 ? 'הודעה חדשה' : `${unseen} הודעות חדשות`}
          </button>
        )}
      </div>

      {intentChip && (
        <div className="border-t border-line bg-card px-3 pt-2.5">
          <p className="mb-1.5 text-[11px] font-bold text-muted">מבוסס על מה ש{name} כתב/ה</p>
          <button
            type="button"
            onClick={() => {
              setText(intentChip);
              inputRef.current?.focus();
            }}
            className="w-full rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-start text-[13px] leading-snug font-semibold text-cta-press transition-transform active:scale-[0.99]"
          >
            {intentChip}
          </button>
        </div>
      )}

      {open && msgs.length === 0 && (
        <div className={`bg-card px-3 pt-2.5 ${intentChip ? '' : 'border-t border-line'}`}>
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

      {panelAbove && <EmojiPicker onPick={pickEmoji} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className={`flex items-end gap-1.5 bg-card px-3 pt-2.5 safe-bottom ${open && (msgs.length === 0 || intentChip || panelAbove) ? '' : 'border-t border-line'}`}
      >
        <button
          type="button"
          aria-label="אימוג׳י"
          aria-pressed={emojiOpen}
          disabled={!open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setEmojiOpen((v) => !v)}
          className={`mb-0.5 flex h-[46px] w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${emojiOpen ? 'bg-primary-soft text-cta' : 'text-muted active:bg-bg'}`}
        >
          <Smile size={23} />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={1000}
          disabled={!open}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) typing.notify();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={open ? 'כתבו הודעה…' : 'הצ׳אט נסגר'}
          className="field max-h-32 min-h-[46px] min-w-0 flex-1 resize-none !rounded-3xl !bg-bg !py-2.5"
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

      <MessageActions
        open={!!actionFor}
        onClose={() => setActionFor(null)}
        preview={actionFor?.content ?? ''}
        myReaction={actionFor ? (inbox.reactions[directKey(actionFor.id)]?.[myId] ?? null) : null}
        onReact={(e) => actionFor && void react(actionFor.id, e)}
      />
    </div>
  );
}
