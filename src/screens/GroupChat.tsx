import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Instagram, Linkedin, LogOut, SendHorizontal, UserPlus, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { AddMembersSheet, type GroupCandidate } from '../components/CreateGroupSheet';
import { toast } from '../lib/notify';
import { instagramUrl, normalizeInstagram, safeProfileUrl } from '../lib/social';
import { formatClock } from '../lib/time';
import { MAX_GROUP_MEMBERS, type GroupsData } from '../hooks/useGroups';

interface Props {
  myId: string;
  groupId: string;
  groups: GroupsData;
  /** Connections + people nearby, for "הוסף משתתף". */
  candidates: GroupCandidate[];
  onBack: () => void;
}

export function GroupChat({ myId, groupId, groups, candidates, onBack }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const group = groups.groups.find((g) => g.id === groupId);
  const members = useMemo(() => groups.members[groupId] ?? [], [groups.members, groupId]);
  const me = members.find((m) => m.member_id === myId);
  const sharing = !!me?.share_socials;
  const byId = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);
  const msgs = useMemo(() => groups.messages.filter((m) => m.group_id === groupId), [groups.messages, groupId]);
  const slots = Math.max(0, MAX_GROUP_MEMBERS - members.length);
  const addable = useMemo(() => {
    const inGroup = new Set(members.map((m) => m.member_id));
    return candidates.filter((c) => !inGroup.has(c.id));
  }, [members, candidates]);

  const { refreshMembers } = groups;
  const openMembers = () => {
    setShowMembers(true);
    void refreshMembers(groupId); // picks up people who left or joined since the last refresh
  };

  const leave = async () => {
    if (leaving || !group || !window.confirm(`לעזוב את "${group.name}"? לא תראו יותר את ההודעות בקבוצה.`)) return;
    setLeaving(true);
    const { error } = await groups.leave(groupId);
    setLeaving(false);
    if (error) return toast('לא הצלחנו לעזוב את הקבוצה', 'error');
    toast(`עזבת את "${group.name}"`, 'info');
    setShowMembers(false);
    history.back(); // popstate → back to the Inbox
  };

  const { markRead } = groups;
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(groupId); // opening it, or a message arriving while I look
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  const toggleShare = async () => {
    const { error } = await groups.setShare(groupId, !sharing);
    if (!error) {
      toast(!sharing ? 'חברי הקבוצה יכולים לראות את ה-LinkedIn וה-Instagram שלך' : 'הפסקת לשתף את הקישורים בקבוצה', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg anim-fade">
      <header className="border-b border-line bg-card px-3 pb-3 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => history.back()} className="rounded-full p-2 text-ink active:bg-bg" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <button onClick={openMembers} className="flex min-w-0 flex-1 items-center gap-3 text-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Users size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{group?.name ?? '…'}</span>
              <span className="block text-[11px] text-muted">{members.length} חברים · לחצו לרשימה</span>
            </span>
          </button>
        </div>
        <button
          onClick={toggleShare}
          aria-pressed={sharing}
          disabled={!me}
          className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
            sharing ? 'border-primary bg-primary text-white' : 'border-primary/30 bg-primary-soft/60 text-primary'
          }`}
        >
          {sharing && <Check size={13} />}
          שתף LinkedIn/IG בקבוצה
        </button>
      </header>

      <main className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <p className="mx-auto mb-3 w-fit max-w-full rounded-full bg-card px-3 py-1 text-center text-[11px] text-muted shadow-sm">
          🔒 קבוצה פרטית · רק החברים רואים את ההודעות
        </p>
        {!group && <p className="pt-6 text-center text-sm text-muted">הקבוצה לא זמינה.</p>}
        {group && msgs.length === 0 && <p className="pt-6 text-center text-sm text-muted">עוד אין הודעות. תפתחו את השיחה 👋</p>}
        {msgs.map((m, i) => {
          const mine = m.sender_id === myId;
          const first = msgs[i - 1]?.sender_id !== m.sender_id;
          const sender = byId.get(m.sender_id);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'pt-2' : ''}`}>
              {!mine && (
                <span className="me-2 mt-auto w-7 shrink-0">
                  {first ? <Avatar url={sender?.avatar_url ?? null} name={sender?.first_name ?? '?'} size={28} /> : null}
                </span>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                  mine ? 'rounded-se-md bg-cta text-white' : 'rounded-ss-md bg-card text-ink'
                }`}
              >
                {!mine && first && <p className="mb-0.5 text-[12px] font-bold text-primary">{sender?.first_name ?? 'מישהו'}</p>}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/80' : 'text-muted'}`}>{formatClock(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 border-t border-line bg-card px-3 pt-2.5 safe-bottom"
      >
        <textarea
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
          placeholder="כתבו הודעה לקבוצה…"
          className="field max-h-32 min-h-[46px] flex-1 resize-none !rounded-3xl !bg-bg !py-2.5"
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

      <BottomSheet open={showMembers} onClose={() => setShowMembers(false)}>
        <h3 className="mb-3 text-lg font-extrabold text-ink">
          {group?.name} <span className="text-sm font-medium text-muted">· {members.length} חברים</span>
        </h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.member_id} className="card flex items-center gap-3 rounded-2xl p-3">
              <Avatar url={m.avatar_url} name={m.first_name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  {m.first_name}
                  {m.member_id === myId && <span className="ms-1.5 text-xs font-medium text-muted">(את/ה)</span>}
                </span>
                {m.headline && <span className="block truncate text-xs text-muted">{m.headline}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {safeProfileUrl(m.linkedin_url) && (
                  <a
                    href={safeProfileUrl(m.linkedin_url) as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`LinkedIn של ${m.first_name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A66C2] text-white active:scale-95"
                  >
                    <Linkedin size={17} />
                  </a>
                )}
                {normalizeInstagram(m.instagram_handle ?? '') && (
                  <a
                    href={instagramUrl(normalizeInstagram(m.instagram_handle ?? '') as string)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Instagram של ${m.first_name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white active:scale-95"
                  >
                    <Instagram size={17} />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-[11px] text-muted">קישורים מופיעים רק אצל מי ששיתף אותם בקבוצה הזו.</p>

        <button
          onClick={() => setAdding(true)}
          disabled={slots === 0}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
        >
          <UserPlus size={18} />
          {slots === 0 ? 'הקבוצה מלאה (30)' : 'הוסף משתתף'}
        </button>
        <button
          onClick={leave}
          disabled={leaving}
          className="mx-auto mt-3 flex items-center gap-1.5 py-1.5 text-sm font-bold text-danger disabled:opacity-50"
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
    </div>
  );
}
