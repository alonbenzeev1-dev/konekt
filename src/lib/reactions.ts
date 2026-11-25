/** The six one-tap reactions (the server accepts exactly these). */
export const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '🙌', '☕'] as const;

/** key ("m:<direct message id>" | "g:<room message id>") → person → emoji. Only people who currently have a reaction are listed. */
export type ReactionMap = Record<string, Record<string, string>>;

export const directKey = (id: string) => `m:${id}`;
export const groupKey = (id: string) => `g:${id}`;

/** "❤" and "❤️" are the same reaction (the variation selector is optional). */
export const sameEmoji = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').replace(/️/g, '') === (b ?? '').replace(/️/g, '');

/** Set (or, with null, clear) one person's reaction. Returns the same object when nothing changed. */
export function withReaction(map: ReactionMap, key: string, userId: string, emoji: string | null): ReactionMap {
  const cur = map[key]?.[userId] ?? null;
  if (cur === emoji) return map;
  const nextUsers = { ...(map[key] ?? {}) };
  if (emoji) nextUsers[userId] = emoji;
  else delete nextUsers[userId];
  const next = { ...map };
  if (Object.keys(nextUsers).length) next[key] = nextUsers;
  else delete next[key];
  return next;
}

/** What tapping `emoji` does to my reaction: same one removes it, another replaces it (mirrors the server). */
export const toggledReaction = (map: ReactionMap, key: string, userId: string, emoji: string): string | null =>
  sameEmoji(map[key]?.[userId], emoji) ? null : emoji;

export interface ReactionPill {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Pills under a message: most used first, ties in the order of the quick-reaction row. */
export function reactionPills(byUser: Record<string, string> | undefined, myId: string): ReactionPill[] {
  if (!byUser) return [];
  const pills = new Map<string, ReactionPill>();
  for (const [user, emoji] of Object.entries(byUser)) {
    const norm = emoji.replace(/️/g, '');
    const p = pills.get(norm) ?? { emoji, count: 0, mine: false };
    p.count += 1;
    if (user === myId) p.mine = true;
    pills.set(norm, p);
  }
  const order = (e: string) => QUICK_REACTIONS.findIndex((q) => sameEmoji(q, e));
  return [...pills.values()].sort((a, b) => b.count - a.count || order(a.emoji) - order(b.emoji));
}
