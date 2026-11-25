import { useMemo, useState } from 'react';
import { Hourglass, MessageCircle, Plus, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { CreateGroupSheet, type GroupCandidate } from '../components/CreateGroupSheet';
import { useNow } from '../hooks/useNow';
import { formatClock, formatHoursLeft, msLeft } from '../lib/time';
import type { ChatThread, Inbox as InboxData } from '../hooks/useInbox';
import type { GroupSummary, GroupsData } from '../hooks/useGroups';

interface Props {
  myId: string;
  inbox: InboxData;
  groups: GroupsData;
  candidates: GroupCandidate[];
  onOpenChat: (chatId: string) => void;
  onOpenGroup: (groupId: string) => void;
}

type Item =
  | { type: 'chat'; key: string; ts: string; thread: ChatThread }
  | { type: 'group'; key: string; ts: string; summary: GroupSummary };

/** "צ׳אטים": 1-on-1 chats and private groups in one list, newest activity first. */
export function ChatsScreen({ myId, inbox, groups, candidates, onOpenChat, onOpenGroup }: Props) {
  const now = useNow(60_000);
  const [creating, setCreating] = useState(false);
  const { threads, people } = inbox;

  const items = useMemo<Item[]>(() => {
    const chats: Item[] = threads
      .filter((t) => msLeft(t.chat.expires_at, now) > 0)
      .map((t) => ({ type: 'chat', key: `c-${t.chat.id}`, ts: t.last?.created_at ?? t.chat.created_at, thread: t }));
    const gs: Item[] = groups.summaries.map((s) => ({ type: 'group', key: `g-${s.group.id}`, ts: s.last?.created_at ?? s.group.created_at, summary: s }));
    return [...chats, ...gs].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [threads, groups.summaries, now]);

  const createGroup = async (name: string, ids: string[]) => {
    const { error, id } = await groups.create(name, ids);
    if (!error && id) {
      setCreating(false);
      onOpenGroup(id);
    }
    return { error };
  };

  return (
    <div className="space-y-4 px-4 pt-2 pb-6">
      <button
        onClick={() => setCreating(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft/60 py-3 text-sm font-bold text-primary transition-transform active:scale-[0.98]"
      >
        <Plus size={17} /> קבוצה חדשה
      </button>
      <CreateGroupSheet open={creating} onClose={() => setCreating(false)} candidates={candidates} onCreate={createGroup} />

      {items.length === 0 && (
        <div className="card mt-2 rounded-3xl px-6 py-10 text-center anim-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MessageCircle size={22} />
          </div>
          <h3 className="font-bold text-ink">עוד אין צ׳אטים</h3>
          <p className="mt-1.5 text-sm text-muted">בקשו צ׳אט מכרטיס של מישהו בסביבי, או פתחו קבוצה. צ׳אט שאושר נמחק אוטומטית אחרי 24 שעות.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {items.map((it) => {
          if (it.type === 'chat') {
            const t = it.thread;
            const p = people[t.partnerId];
            const mine = t.last?.sender_id === myId;
            return (
              <li key={it.key}>
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
          }
          const { group, last } = it.summary;
          const count = groups.members[group.id]?.length;
          const who = last ? (last.sender_id === myId ? 'את/ה' : groups.members[group.id]?.find((m) => m.member_id === last.sender_id)?.first_name) : null;
          return (
            <li key={it.key}>
              <button
                onClick={() => onOpenGroup(group.id)}
                className="card flex w-full items-center gap-3 rounded-2xl p-3 text-start transition-transform active:scale-[0.985]"
              >
                <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Users size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-ink">{group.name}</span>
                    {last && <span className="shrink-0 text-[11px] text-muted">{formatClock(last.created_at)}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {last ? `${who ? who + ': ' : ''}${last.content}` : count ? `${count} חברים · עוד אין הודעות` : 'עוד אין הודעות'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
