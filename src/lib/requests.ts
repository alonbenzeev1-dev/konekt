import { kindLabel } from './social';
import type { ConnectionRequest, Platform, RequestKind } from './types';

/** A request not answered within this long expires. */
export const PENDING_WINDOW_MS = 2 * 3600_000;
/** An approved link stays open this long (counted from the request, as everywhere else in the app). */
export const ACTIVE_WINDOW_MS = 48 * 3600_000;
/** How far back the app loads requests: the server deletes handled ones after 7 days. */
export const HISTORY_WINDOW_MS = 7 * 24 * 3600_000;

const ms = (iso: string) => Date.parse(iso);

export const isLivePending = (r: ConnectionRequest, now: number) => r.status === 'pending' && ms(r.expires_at) > now;
/** Approved and still inside the 48 h window (chat approvals live in Chats, not here). */
export const isActiveLink = (r: ConnectionRequest, now: number) =>
  r.status === 'accepted' && r.kind !== 'chat' && now - ms(r.created_at) < ACTIVE_WINDOW_MS;
export const activeUntil = (r: ConnectionRequest) => ms(r.created_at) + ACTIVE_WINDOW_MS;

const otherOf = (r: ConnectionRequest, myId: string) => (r.sender_id === myId ? r.receiver_id : r.sender_id);
const newest = (a: ConnectionRequest | undefined, b: ConnectionRequest) => (!a || ms(b.created_at) > ms(a.created_at) ? b : a);

/** My live request (pending, or approved and still open) of this kind to that person. */
export function findRequest(requests: ConnectionRequest[], myId: string, userId: string, kind: RequestKind, now: number) {
  return (
    requests.find(
      (x) =>
        x.sender_id === myId &&
        x.receiver_id === userId &&
        x.kind === kind &&
        (isLivePending(x, now) || (x.status === 'accepted' && now - ms(x.created_at) < ACTIVE_WINDOW_MS)),
    ) ?? null
  );
}

/** Say WHY a request could not be sent. */
export function requestFailureText(error: string, name: string, kind: RequestKind) {
  if (error.includes('chat already open')) return 'כבר יש ביניכם צ׳אט פתוח';
  if (/no (linkedin|instagram)/.test(error)) return `${name} עדיין לא הוסיף/ה ${kindLabel[kind]}`;
  if (error.includes('user unavailable')) return `${name} כבר לא זמין/ה`;
  return 'לא הצלחנו לשלוח את הבקשה';
}

/** Pending requests inside their 2 h window, split by direction, one per (person, kind), soonest to expire first. */
export function pendingSplit(requests: ConnectionRequest[], myId: string, now: number) {
  const pick = (mine: boolean) => {
    const byKey = new Map<string, ConnectionRequest>();
    for (const r of requests) {
      if (!isLivePending(r, now) || (r.sender_id === myId) !== mine) continue;
      const key = `${otherOf(r, myId)}|${r.kind}`;
      byKey.set(key, newest(byKey.get(key), r));
    }
    return [...byKey.values()].sort((a, b) => ms(a.expires_at) - ms(b.expires_at));
  };
  return { incoming: pick(false), outgoing: pick(true) };
}

export interface ConnectionEntry {
  /** I asked, they approved: I can open THEIR profile. */
  sent?: ConnectionRequest;
  /** They asked, I approved: they can open MINE. */
  received?: ConnectionRequest;
}
export interface PersonConnection {
  personId: string;
  kinds: Partial<Record<Platform, ConnectionEntry>>;
  latest: number;
}

/** Approved links inside the 48 h window, merged into ONE card per person (both directions, both platforms). */
export function activeConnections(requests: ConnectionRequest[], myId: string, now: number): PersonConnection[] {
  const people = new Map<string, PersonConnection>();
  for (const r of requests) {
    if (!isActiveLink(r, now)) continue;
    const kind = r.kind as Platform;
    const personId = otherOf(r, myId);
    const p = people.get(personId) ?? { personId, kinds: {}, latest: 0 };
    const e = p.kinds[kind] ?? {};
    const slot = r.sender_id === myId ? 'sent' : 'received';
    e[slot] = newest(e[slot], r);
    p.kinds[kind] = e;
    p.latest = Math.max(p.latest, ms(r.created_at));
    people.set(personId, p);
  }
  return [...people.values()].sort((a, b) => b.latest - a.latest);
}

export interface HistoryItem {
  key: string;
  personId: string;
  kind: RequestKind;
  direction: 'sent' | 'received';
  outcome: 'expired' | 'ended';
  /** When it lapsed / when the 48 h link closed. */
  at: number;
  /** Only requests I sent can be asked again. */
  canRetry: boolean;
}

/**
 * Expired requests and approvals older than 48 h, newest first, one row per (person, platform).
 * Anything that is live again (pending or open) is not history.
 */
export function historyItems(requests: ConnectionRequest[], myId: string, now: number): HistoryItem[] {
  const live = new Set<string>();
  for (const r of requests) {
    if (isLivePending(r, now) || isActiveLink(r, now)) live.add(`${otherOf(r, myId)}|${r.kind}`);
  }
  const byKey = new Map<string, HistoryItem>();
  for (const r of requests) {
    const key = `${otherOf(r, myId)}|${r.kind}`;
    if (live.has(key)) continue;
    let outcome: HistoryItem['outcome'] | null = null;
    let at = 0;
    if (r.status === 'expired' || (r.status === 'pending' && ms(r.expires_at) <= now)) {
      outcome = 'expired';
      at = Math.min(ms(r.expires_at), now);
    } else if (r.status === 'accepted' && r.kind !== 'chat' && !isActiveLink(r, now)) {
      outcome = 'ended';
      at = activeUntil(r);
    }
    if (!outcome) continue;
    const direction = r.sender_id === myId ? 'sent' : 'received';
    const item: HistoryItem = { key, personId: otherOf(r, myId), kind: r.kind, direction, outcome, at, canRetry: direction === 'sent' && r.kind !== 'chat' };
    const prev = byKey.get(key);
    if (!prev || item.at > prev.at) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => b.at - a.at);
}
