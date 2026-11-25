import { useMemo, useState } from 'react';
import { Hourglass, MapPin, MessageCircle, Plus, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { CreateGroupSheet, type GroupCandidate } from '../components/CreateGroupSheet';
import { Segmented } from '../components/Segmented';
import { useNow } from '../hooks/useNow';
import { messagePreview } from '../lib/chatText';
import { formatClock, formatHoursLeft, msLeft } from '../lib/time';
import type { Inbox as InboxData } from '../hooks/useInbox';
import type { GroupsData } from '../hooks/useGroups';

interface Props {
  myId: string;
  inbox: InboxData;
  groups: GroupsData;
  candidates: GroupCandidate[];
  onOpenChat: (chatId: string) => void;
  onOpenGroup: (groupId: string) => void;
}

type View = 'direct' | 'groups';

/** "צ׳אטים": 1-on-1 conversations and group rooms, kept apart, each with its own unread count. */
export function ChatsScreen({ myId, inbox, groups, candidates, onOpenChat, onOpenGroup }: Props) {
  const now = useNow(60_000);
  const [creating, setCreating] = useState(false);
  const { threads, people } = inbox;

  const liveThreads = useMemo(
    () =>
      threads
        .filter((t) => msLeft(t.chat.expires_at, now) > 0)
        .sort((a, b) => (b.last?.created_at ?? b.chat.created_at).localeCompare(a.last?.created_at ?? a.chat.created_at)),
    [threads, now],
  );
  const directUnread = liveThreads.filter((t) => t.unread > 0).length;
  const groupUnread = Object.keys(groups.unread).length;

  // land where something is waiting
  const [view, setView] = useState<View>(() => (groupUnread > 0 && directUnread === 0 ? 'groups' : 'direct'));

  const createGroup = async (name: string, ids: string[], extras: { description: string; location: string }) => {
    const { error, id } = await groups.create(name, ids, extras);
    if (!error && id) {
      setCreating(false);
      setView('groups');
      onOpenGroup(id);
    }
    return { error };
  };

  return (
    <div className="space-y-4 px-4 pt-2 pb-6">
      <Segmented
        label="סוג שיחה"
        value={view}
        onChange={setView}
        options={[
          { id: 'direct', label: 'שיחות אישיות', badge: directUnread },
          { id: 'groups', label: 'קבוצות וחדרים', badge: groupUnread },
        ]}
      />

      {view === 'direct' ? (
        liveThreads.length === 0 ? (
          <Empty icon={<MessageCircle size={22} />} title="עוד אין שיחות אישיות" body="בקשו צ׳אט מכרטיס של מישהו בסביבי. צ׳אט שאושר נמחק אוטומטית אחרי 24 שעות." />
        ) : (
          <ul className="space-y-2.5">
            {liveThreads.map((t) => {
              const p = people[t.partnerId];
              const mine = t.last?.sender_id === myId;
              return (
                <li key={t.chat.id}>
                  <button
                    onClick={() => onOpenChat(t.chat.id)}
                    className="card flex min-h-[72px] w-full items-center gap-3 rounded-2xl p-3 text-start transition-transform active:scale-[0.985]"
                  >
                    <Avatar url={p?.avatar_url ?? null} name={p?.first_name ?? '…'} size={50} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span dir="auto" className="truncate font-bold text-ink">{p?.first_name ?? '…'}</span>
                        {t.last && <span className="shrink-0 text-[11px] text-muted tabular-nums">{formatClock(t.last.created_at)}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${t.unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                          {t.last ? `${mine ? 'את/ה: ' : ''}${t.last.content}` : 'הצ׳אט נפתח'}
                        </span>
                        {t.unread > 0 ? (
                          <span dir="ltr" className="shrink-0 rounded-full bg-cta px-1.5 text-[11px] leading-5 font-bold text-white tabular-nums">{t.unread}</span>
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
          </ul>
        )
      ) : (
        <>
          <button onClick={() => setCreating(true)} className="btn-primary flex w-full items-center justify-center gap-2 text-base">
            <Plus size={18} /> קבוצה / חדר חדש
          </button>

          {groups.summaries.length === 0 ? (
            <Empty
              icon={<Users size={22} />}
              title="עוד אין קבוצות או חדרים"
              body="פתחו חדר לקורס, לאירוע או לשולחן בספרייה, והזמינו אליו בקוד QR. מי שמצטרף רואה את כולם."
            />
          ) : (
            <ul className="space-y-2.5">
              {groups.summaries.map(({ group, last }) => {
                const count = groups.members[group.id]?.length;
                const unread = groups.unread[group.id] ?? 0;
                const who = last
                  ? last.sender_id === myId
                    ? 'את/ה'
                    : groups.members[group.id]?.find((m) => m.member_id === last.sender_id)?.first_name
                  : null;
                return (
                  <li key={group.id}>
                    <button
                      onClick={() => onOpenGroup(group.id)}
                      className="card flex min-h-[72px] w-full items-center gap-3 rounded-2xl p-3 text-start transition-transform active:scale-[0.985]"
                    >
                      <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-cta">
                        <Users size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span dir="auto" className="truncate font-bold text-ink">{group.name}</span>
                          {last && <span className="shrink-0 text-[11px] text-muted tabular-nums">{formatClock(last.created_at)}</span>}
                        </span>
                        {group.location_tag && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-cta-press">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{group.location_tag}</span>
                          </span>
                        )}
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                            {last ? `${who ? who + ': ' : ''}${messagePreview(last)}` : count ? `${count} חברים · עוד אין הודעות` : 'עוד אין הודעות'}
                          </span>
                          {unread > 0 && (
                            <span dir="ltr" className="shrink-0 rounded-full bg-cta px-1.5 text-[11px] leading-5 font-bold text-white tabular-nums">{unread}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <CreateGroupSheet open={creating} onClose={() => setCreating(false)} candidates={candidates} onCreate={createGroup} />
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card mt-1 rounded-3xl px-6 py-10 text-center anim-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-cta">{icon}</div>
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[290px] text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
