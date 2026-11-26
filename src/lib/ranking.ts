import type { NearbyUser } from './types';

/** Words too common to count as "the same topic". */
const STOP = new Set(['את', 'של', 'על', 'עם', 'אני', 'מחפש', 'מחפשת', 'לי', 'או', 'גם', 'כל', 'מי', 'יש', 'רוצה', 'עכשיו', 'כרגע', 'the', 'and', 'for', 'with']);

/** Lower-case words of 3+ letters from a status line. */
export function intentKeywords(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const w of (text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(w);
    // Hebrew glues one-letter prefixes on (בספרייה, לאלגוריתמים): also keep the bare word
    if (w.length >= 5 && /^[בלהומשכ]/u.test(w)) out.add(w.slice(1));
  }
  return out;
}

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);

/** Proximity, 0-30: flat to 60 m ("ממש לידך"), tapering through 150 m ("בבניין / באזור") to 400 m ("בקמפוס"). */
export function proximityScore(m: number): number {
  if (m <= 60) return 30;
  if (m <= 150) return lerp(m, 60, 150, 30, 20);
  if (m <= 400) return lerp(m, 150, 400, 20, 5);
  return 0;
}

/** Freshness, 0-20: full within 10 minutes ("פעיל עכשיו"), then linear down to 0 at 45. */
export function freshnessScore(mins: number): number {
  if (mins <= 10) return 20;
  if (mins >= 45) return 0;
  return lerp(mins, 10, 45, 20, 0);
}

export interface RankContext {
  /** My own live status (null = none). */
  myIntent: string | null;
  /** Everyone who shares at least one of my rooms. */
  sharedIds: ReadonlySet<string>;
}

export interface Ranked {
  user: NearbyUser;
  score: number;
  hasIntent: boolean;
  shared: boolean;
}

/** +20 for a live status (+10 more when it overlaps with mine), +15 for a shared room, plus proximity and freshness. */
export function scoreUser(u: NearbyUser, ctx: RankContext, myWords: Set<string> = intentKeywords(ctx.myIntent)): Ranked {
  const hasIntent = !!u.current_intent?.trim();
  const shared = ctx.sharedIds.has(u.id);
  let score = proximityScore(u.distance_m) + freshnessScore(u.active_minutes ?? 0);
  if (hasIntent) {
    score += 20;
    if (myWords.size > 0) for (const w of intentKeywords(u.current_intent)) if (myWords.has(w)) { score += 10; break; }
  }
  if (shared) score += 15;
  return { user: u, score, hasIntent, shared };
}

export function rankNearby(users: NearbyUser[], ctx: RankContext): Ranked[] {
  const words = intentKeywords(ctx.myIntent);
  return users.map((u) => scoreUser(u, ctx, words)).sort((a, b) => b.score - a.score || a.user.distance_m - b.user.distance_m);
}

export type NearbyFilter = 'all' | 'intent' | 'room' | 'close';

export const matchesFilter = (r: Ranked, f: NearbyFilter) =>
  f === 'all' || (f === 'intent' && r.hasIntent) || (f === 'room' && r.shared) || (f === 'close' && r.user.distance_m <= 60);

export const SPOTLIGHT_MAX = 5;

/** Spotlight: the best (up to 5) who have a live status or share a room with me. Everyone else goes to the compact list. */
export function splitTiers(ranked: Ranked[]): { spotlight: Ranked[]; rest: Ranked[] } {
  const spotlight = ranked.filter((r) => r.hasIntent || r.shared).slice(0, SPOTLIGHT_MAX);
  const ids = new Set(spotlight.map((r) => r.user.id));
  return { spotlight, rest: ranked.filter((r) => !ids.has(r.user.id)) };
}
