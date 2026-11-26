import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BarChart3, Check, ChevronLeft, Instagram, Linkedin, Loader2, LogOut, MapPin, MessageCircle, Pin, PinOff, Plus, QrCode, SendHorizontal, Smile, UserPlus, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { AddMembersSheet, type GroupCandidate } from '../components/CreateGroupSheet';
import { EmojiPicker, insertAtCursor } from '../components/EmojiPicker';
import { InviteSheet } from '../components/InviteSheet';
import { MessageActions } from '../components/MessageActions';
import { Openable } from '../components/Openable';
import { PinnedBar } from '../components/PinnedBar';
import { PollCard } from '../components/PollCard';
import { PollSheet } from '../components/PollSheet';
import { ReactionPills } from '../components/ReactionPills';
import { ctaBase } from '../components/StudentCard';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { firstUrl, messagePreview } from '../lib/chatText';
import { toast } from '../lib/notify';
import { groupKey, reactionPills } from '../lib/reactions';
import { instagramUrl, normalizeInstagram, safeProfileUrl } from '../lib/social';
import { formatClock } from '../lib/time';
import { MAX_GROUP_MEMBERS, type GroupsData } from '../hooks/useGroups';
import type { GroupMember, GroupMessage, Platform } from '../lib/types';

interface Props {
  myId: string;
  groupId: string;
  groups: GroupsData;
  /** Connections + people nearby, for "הוסף משתתף". */
  candidates: GroupCandidate[];
  /** Which of MY links exist: decides whether sharing them is possible. */
  myLinks: Record<Platform, boolean>;
  onBack: () => void;
}

/** Instagram is its own switch; rooms created before that existed fall back to the LinkedIn flag. */
const sharesInstagram = (m: GroupMember) => m.share_instagram ?? m.share_socials;

/** Pills that open a member's shared profiles. Only what they chose to share in THIS room. */
function MemberLinks({ m }: { m: GroupMember }) {
  const li = safeProfileUrl(m.linkedin_url);
  const igHandle = m.instagram_handle ? normalizeInstagram(m.instagram_handle) : null;
  if (!li && !igHandle) return null;
  return (
    <div className="mt-2.5 flex gap-2">
      {li && (
        <a
          href={li}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`פתיחת הפרופיל של ${m.first_name} ב-LinkedIn`}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] px-3 text-sm font-bold text-white active:scale-[0.98]"
        >
          <Linkedin size={16} /> פתח ב-LinkedIn ↗
        </a>
      )}
      {igHandle && (
        <a
          href={instagramUrl(igHandle)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Instagram של ${m.first_name}`}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white active:scale-[0.98]"
        >
          <Instagram size={18} />
        </a>
      )}
    </div>
  );
}

export function GroupChat({ myId, groupId, groups, candidates, myLinks, onBack }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [actionFor, setActionFor] = useState<GroupMessage | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const group = groups.groups.find((g) => g.id === groupId);
  const members = useMemo(() => groups.members[groupId] ?? [], [groups.members, groupId]);
  const me = members.find((m) => m.member_id === myId);
  const sharedLinkedIn = !!me?.share_socials;
  const sharedInstagram = me ? sharesInstagram(me) : false;
  const byId = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);
  const msgs = useMemo(() => groups.messages.filter((m) => m.group_id === groupId), [groups.messages, groupId]);
  const slots = Math.max(0, MAX_GROUP_MEMBERS - members.length);
  const addable = useMemo(() => {
    const inGroup = new Set(members.map((m) => m.member_id));
    return candidates.filter((c) => !inGroup.has(c.id));
  }, [members, candidates]);

  const isCreator = !!group && group.created_by === myId;
  const pinned = group?.pinned_message_id ? msgs.find((m) => m.id === group.pinned_message_id) : undefined;
  const { mainRef, endRef, onScroll, unseen, jump } = useStickToBottom(msgs.length, msgs[msgs.length - 1]?.sender_id === myId);

  const { refreshMembers } = groups;
  const openMembers = () => {
    setShowMembers(true);
    void refreshMembers(groupId); // picks up people who left or joined since the last refresh
  };

  const leave = async () => {
    if (leaving || !group || !window.confirm(`לעזוב את "${group.name}"? לא תראו יותר את ההודעות בחדר.`)) return;
    setLeaving(true);
    const { error } = await groups.leave(groupId);
    setLeaving(false);
    if (error) return toast('לא הצלחנו לעזוב', 'error');
    toast(`עזבת את "${group.name}"`, 'info');
    setShowMembers(false);
    history.back(); // popstate → back to the chats list
  };

  const { markRead } = groups;
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(groupId); // opening it, or a message arriving while I look
  }, [msgs.length, groupId, markRead]);

  // coming back to the app with this group open
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') markRead(groupId); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [groupId, markRead]);

  // Android back button / swipe closes the chat instead of leaving the app.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    history.pushState({ group: groupId }, '');
    const onPop = () => onBackRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [groupId]);

  const send = async () => {
    const v = text.trim();
    if (!v || sending || !group) return;
    setSending(true);
    const { error } = await groups.sendMessage(groupId, v);
    setSending(false);
    if (error) toast('ההודעה לא נשלחה', 'error');
    else setText('');
  };

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
    const { error } = await groups.react(messageId, emoji);
    if (error) toast('התגובה לא נשלחה', 'error');
  };

  /** "שתף את ה-LinkedIn שלי בחדר": my link becomes visible to the room and a card is posted in the chat. */
  const shareLinkedIn = async () => {
    if (sharing) return;
    setSharing(true);
    const { error } = await groups.shareLinkedIn(groupId);
    setSharing(false);
    if (error) return toast(error.includes('no linkedin') ? 'צריך קודם להוסיף קישור LinkedIn בפרופיל' : 'לא הצלחנו לשתף. נסו שוב.', 'error');
    toast('ה-LinkedIn שלך משותף בחדר', 'success');
  };

  const stopLinkedIn = async () => {
    const { error } = await groups.setShare(groupId, false);
    if (!error) toast('הפסקת לשתף את ה-LinkedIn בחדר', 'info');
  };

  const pin = async (messageId: string | null) => {
    const { error } = await groups.pinMessage(groupId, messageId);
    if (!error) toast(messageId ? 'ההודעה נעוצה בראש החדר' : 'הנעיצה הוסרה', 'success');
  };

  const jumpToPinned = () => {
    if (!pinned) return;
    document.getElementById(`gm-${pinned.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlight(pinned.id);
    window.setTimeout(() => setHighlight(null), 1600);
  };

  const togglePanel = (which: 'emoji' | 'menu') => {
    setEmojiOpen(which === 'emoji' ? (v) => !v : false);
    setMenuOpen(which === 'menu' ? (v) => !v : false);
  };
  const panelAbove = emojiOpen || menuOpen;

  const pillsOf = (m: GroupMessage) => reactionPills(groups.reactions[groupKey(m.id)], myId);

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg anim-fade">
      <header className="border-b border-line bg-card px-3 pb-2.5 safe-top">
        <div className="flex items-center gap-1.5">
          <button onClick={() => history.back()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-bg" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <button onClick={openMembers} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-cta">
              <Users size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-right font-bold text-ink">{group?.name ?? '…'}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                {group?.location_tag && (
                  <span className="inline-flex min-w-0 items-center gap-0.5 font-medium text-cta-press">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{group.location_tag}</span>
                  </span>
                )}
                <span className="shrink-0 tabular-nums">{members.length} חברים</span>
              </span>
            </span>
            <ChevronLeft size={16} className="shrink-0 text-muted" />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            disabled={!group}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary-soft px-3 text-sm font-bold text-cta-press active:scale-[0.97] disabled:opacity-50"
          >
            <QrCode size={17} />
            הזמנה / QR
          </button>
        </div>
      </header>

      {pinned && (
        <PinnedBar
          preview={messagePreview(pinned)}
          url={pinned.kind === 'poll' || pinned.kind === 'linkedin' ? null : firstUrl(pinned.content)}
          canUnpin={isCreator}
          onJump={jumpToPinned}
          onUnpin={() => void pin(null)}
        />
      )}

      {/* one tap: share my LinkedIn with everyone in the room */}
      <div className="border-b border-line bg-card px-3 py-2.5">
        {sharedLinkedIn ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold text-[#0A66C2]">
              <Check size={16} strokeWidth={3} className="shrink-0" />
              <span className="truncate">ה-LinkedIn שלך משותף בחדר</span>
            </span>
            {myLinks.instagram && (
              <button
                onClick={() => void groups.setShareInstagram(groupId, !sharedInstagram)}
                aria-pressed={sharedInstagram}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                  sharedInstagram ? 'border-[#B21E62] bg-[#B21E62] text-white' : 'border-line bg-card text-ink'
                }`}
              >
                <Instagram size={14} /> {sharedInstagram ? 'Instagram משותף' : 'שתף גם Instagram'}
              </button>
            )}
            <button onClick={stopLinkedIn} className="min-h-[44px] px-1 text-xs font-bold text-muted underline-offset-2 active:underline">
              הפסק
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={shareLinkedIn}
              disabled={!myLinks.linkedin || sharing || !me}
              className={`${ctaBase} bg-[#0A66C2] text-white active:scale-[0.98] disabled:opacity-50`}
            >
              {sharing ? <Loader2 size={17} className="animate-spin" /> : <Linkedin size={17} />}
              שתף את ה-LinkedIn שלי בחדר
            </button>
            {!myLinks.linkedin && <p className="mt-1.5 text-center text-[11px] text-muted">הוסיפו קישור LinkedIn בפרופיל כדי לשתף אותו</p>}
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <main ref={mainRef} onScroll={onScroll} className="flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4">
          <p className="mx-auto mb-3 w-fit max-w-full rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted shadow-sm">
            🔒 חדר פרטי · רק החברים רואים את ההודעות
          </p>
          {group?.description && <p dir="auto" className="mx-auto mb-3 max-w-[320px] text-center text-xs leading-relaxed text-ink/70">{group.description}</p>}
          {!group && <p className="pt-6 text-center text-sm text-muted">החדר לא זמין.</p>}
          {group && msgs.length === 0 && <p className="pt-6 text-center text-sm text-muted">עוד אין הודעות. תפתחו את השיחה 👋</p>}
          {msgs.map((m, i) => {
            const mine = m.sender_id === myId;
            const first = msgs[i - 1]?.sender_id !== m.sender_id;
            const sender = byId.get(m.sender_id);
            const lit = highlight === m.id ? 'rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-bg transition-shadow' : '';
            const avatar = (
              <span className="me-2 mt-auto w-7 shrink-0">
                {first ? <Avatar url={sender?.avatar_url ?? null} name={sender?.first_name ?? '?'} size={28} /> : null}
              </span>
            );
            const pills = <ReactionPills pills={pillsOf(m)} mine={mine} onToggle={(e) => void react(m.id, e)} />;
            const column = `flex min-w-0 flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`;

            if (m.kind === 'poll') {
              return (
                <div key={m.id} id={`gm-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} pt-2`}>
                  {!mine && avatar}
                  <div className={`${column} w-full`}>
                    <Openable onOpen={() => setActionFor(m)} className={`w-full ${mine ? 'flex justify-end' : 'flex justify-start'} ${lit}`}>
                      <PollCard
                        poll={m.poll_id ? groups.polls[m.poll_id] : undefined}
                        votes={m.poll_id ? groups.votes[m.poll_id] : undefined}
                        myId={myId}
                        by={mine ? 'את/ה' : (sender?.first_name ?? 'מישהו')}
                        onVote={(o) => m.poll_id && void groups.votePoll(m.poll_id, o)}
                      />
                    </Openable>
                    {pills}
                  </div>
                </div>
              );
            }

            if (m.kind === 'linkedin') {
              const li = sender ? safeProfileUrl(sender.linkedin_url) : null;
              return (
                <div key={m.id} id={`gm-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} pt-2`}>
                  {!mine && avatar}
                  <div className={column}>
                    <Openable onOpen={() => setActionFor(m)} className={`w-[82%] min-w-[240px] max-w-[300px] rounded-2xl border border-[#0A66C2]/20 bg-card p-3 shadow-sm ${lit}`}>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[#0A66C2]">
                        <Linkedin size={13} /> {mine ? 'שיתפת את ה-LinkedIn שלך' : 'שיתף/ה את ה-LinkedIn'}
                      </p>
                      <div className="flex items-center gap-2.5">
                        <Avatar url={sender?.avatar_url ?? null} name={sender?.first_name ?? '?'} size={44} />
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="block truncate text-right font-bold text-ink">{sender?.first_name ?? 'מישהו'}</span>
                          {sender?.headline && <span dir="auto" className="line-clamp-2 block text-right text-xs leading-snug text-ink/70">{sender.headline}</span>}
                        </span>
                      </div>
                      {li ? (
                        <a
                          href={li}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`${ctaBase} mt-2.5 bg-[#0A66C2] text-white active:scale-[0.98]`}
                        >
                          <Linkedin size={16} /> פתח ב-LinkedIn ↗
                        </a>
                      ) : (
                        <p className="mt-2.5 rounded-xl bg-bg px-3 py-2 text-center text-xs text-muted">הקישור כבר לא משותף בחדר</p>
                      )}
                      <p className="mt-1.5 text-[10px] text-muted tabular-nums">{formatClock(m.created_at)}</p>
                    </Openable>
                    {pills}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} id={`gm-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'pt-2' : ''}`}>
                {!mine && avatar}
                <div className={`${column} max-w-[78%]`}>
                  <Openable
                    onOpen={() => setActionFor(m)}
                    className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                      mine ? 'rounded-se-md bg-cta text-white' : 'rounded-ss-md bg-card text-ink'
                    } ${lit}`}
                  >
                    {!mine && first && <p className="mb-0.5 text-[12px] font-bold text-cta-press">{sender?.first_name ?? 'מישהו'}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`mt-0.5 text-[10px] tabular-nums ${mine ? 'text-white/80' : 'text-muted'}`}>{formatClock(m.created_at)}</p>
                  </Openable>
                  {pills}
                </div>
              </div>
            );
          })}
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

      {emojiOpen && <EmojiPicker onPick={pickEmoji} />}
      {menuOpen && (
        <div className="border-t border-line bg-card px-3 py-1.5" role="menu" aria-label="פעולות">
          <button
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPollOpen(true);
            }}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-bold text-ink active:bg-bg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-cta"><BarChart3 size={16} /></span>
            סקר מהיר
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className={`flex items-end gap-1 bg-card px-3 pt-2.5 safe-bottom ${panelAbove ? '' : 'border-t border-line'}`}
      >
        <button
          type="button"
          aria-label="עוד פעולות"
          aria-expanded={menuOpen}
          disabled={!group}
          onClick={() => togglePanel('menu')}
          className={`mb-0.5 flex h-[46px] w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${menuOpen ? 'bg-primary-soft text-cta' : 'text-muted active:bg-bg'}`}
        >
          <Plus size={23} className={`transition-transform duration-200 ${menuOpen ? 'rotate-45' : ''}`} />
        </button>
        <button
          type="button"
          aria-label="אימוג׳י"
          aria-pressed={emojiOpen}
          disabled={!group}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => togglePanel('emoji')}
          className={`mb-0.5 flex h-[46px] w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${emojiOpen ? 'bg-primary-soft text-cta' : 'text-muted active:bg-bg'}`}
        >
          <Smile size={23} />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={1000}
          disabled={!group}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="כתבו הודעה לחדר…"
          className="field max-h-32 min-h-[46px] min-w-0 flex-1 resize-none !rounded-3xl !bg-bg !py-2.5"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending || !group}
          className="btn-primary mb-0.5 flex h-[46px] w-[46px] shrink-0 items-center justify-center !rounded-full"
          aria-label="שליחה"
        >
          <SendHorizontal size={19} className="-scale-x-100" />
        </button>
      </form>

      <MessageActions
        open={!!actionFor}
        onClose={() => setActionFor(null)}
        preview={actionFor ? messagePreview(actionFor) : ''}
        myReaction={actionFor ? (groups.reactions[groupKey(actionFor.id)]?.[myId] ?? null) : null}
        onReact={(e) => actionFor && void react(actionFor.id, e)}
      >
        {isCreator && actionFor && (
          <button
            onClick={() => {
              void pin(pinned?.id === actionFor.id ? null : actionFor.id);
              setActionFor(null);
            }}
            className="btn-ghost flex w-full items-center justify-center gap-2 text-sm font-bold text-ink"
          >
            {pinned?.id === actionFor.id ? <PinOff size={17} /> : <Pin size={17} />}
            {pinned?.id === actionFor.id ? 'הסרת נעיצה' : 'נעיצת הודעה'}
          </button>
        )}
      </MessageActions>

      <PollSheet open={pollOpen} onClose={() => setPollOpen(false)} onCreate={(q, o) => groups.createPoll(groupId, q, o)} />

      <BottomSheet open={showMembers} onClose={() => setShowMembers(false)}>
        <h3 className="text-lg font-extrabold text-ink">
          <span dir="auto">{group?.name}</span> <span className="text-sm font-medium text-muted tabular-nums">· {members.length} חברים</span>
        </h3>
        {group?.location_tag && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-cta-press">
            <MapPin size={12} /> {group.location_tag}
          </p>
        )}
        {group?.description && <p dir="auto" className="mt-2 text-sm leading-relaxed text-ink/70">{group.description}</p>}

        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li key={m.member_id} className="card rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <Avatar url={m.avatar_url} name={m.first_name} size={44} />
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-right font-bold text-ink">
                    {m.first_name}
                    {m.member_id === myId && <span className="ms-1.5 text-xs font-medium text-muted">(את/ה)</span>}
                  </span>
                  {m.headline && <span dir="auto" className="line-clamp-2 block text-right text-xs leading-snug text-ink/70">{m.headline}</span>}
                </span>
              </div>
              {m.current_intent && (
                <p dir="auto" className="mt-2 flex items-start gap-1.5 rounded-xl bg-bg px-2.5 py-1.5 text-right text-[13px] leading-snug text-ink/80">
                  <MessageCircle size={13} aria-hidden className="mt-[3px] shrink-0 text-cta" />
                  <span>
                    <span className="font-bold text-ink">כרגע: </span>
                    {m.current_intent}
                  </span>
                </p>
              )}
              <MemberLinks m={m} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-[11px] text-muted">כל חברי החדר רואים שם, תמונה ותיאור. קישורים מופיעים רק למי ששיתף אותם בחדר הזה.</p>

        <div className="mt-4 space-y-2">
          <button onClick={() => { setShowMembers(false); setShowInvite(true); }} className="btn-ghost flex w-full items-center justify-center gap-2 text-sm font-bold">
            <QrCode size={17} /> הזמנה / QR
          </button>
          <button
            onClick={() => setAdding(true)}
            disabled={slots === 0}
            className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus size={18} />
            {slots === 0 ? `החדר מלא (${MAX_GROUP_MEMBERS})` : 'הוסף משתתף'}
          </button>
        </div>
        <button
          onClick={leave}
          disabled={leaving}
          className="mx-auto mt-3 flex min-h-[44px] items-center gap-1.5 px-3 text-sm font-bold text-danger disabled:opacity-50"
        >
          <LogOut size={15} className="-scale-x-100" />
          עזוב קבוצה
        </button>
      </BottomSheet>

      <AddMembersSheet
        open={adding}
        onClose={() => setAdding(false)}
        candidates={addable}
        slots={slots}
        onAdd={(ids) => groups.addMembers(groupId, ids)}
      />
      {group && <InviteSheet open={showInvite} onClose={() => setShowInvite(false)} group={group} isCreator={isCreator} onReset={() => groups.resetInvite(group.id)} onLock={(v) => groups.setInvitesLocked(group.id, v)} />}
    </div>
  );
}
