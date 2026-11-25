import { useMemo } from 'react';
import type { GroupCandidate } from '../components/CreateGroupSheet';
import type { Inbox } from './useInbox';
import type { NearbyUser } from '../lib/types';

/** Who can be put in a group: people I'm connected to, plus visible people near me right now. */
export function useGroupCandidates(myId: string, inbox: Inbox, nearby: NearbyUser[]): GroupCandidate[] {
  const { requests, threads, people } = inbox;
  return useMemo(() => {
    const out = new Map<string, GroupCandidate>();
    const connected = [
      ...requests.filter((r) => r.status === 'accepted').map((r) => (r.sender_id === myId ? r.receiver_id : r.sender_id)),
      ...threads.map((t) => t.partnerId),
    ];
    for (const id of connected) {
      const p = people[id];
      if (p && !out.has(id)) out.set(id, { id, first_name: p.first_name, headline: p.headline, avatar_url: p.avatar_url, source: 'connection' });
    }
    for (const u of nearby) {
      if (!out.has(u.id)) out.set(u.id, { id: u.id, first_name: u.first_name, headline: u.headline, avatar_url: u.avatar_url, source: 'nearby' });
    }
    return [...out.values()];
  }, [requests, threads, people, nearby, myId]);
}
