/** Read-state helpers: a map of conversation id → ISO time of the last message the user has seen. */

export type ReadMap = Record<string, string>;

/** True if `ts` is later than `than` (or there is nothing to compare with). Compares real instants, not strings. */
export const isLater = (ts: string, than?: string) => !than || Date.parse(ts) > Date.parse(than);

export function loadReads(key: string): ReadMap {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    return {};
  }
}

export function saveReads(key: string, map: ReadMap) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

/** Keep the later time per id. Returns `prev` itself when nothing changed (so setState can bail out). */
export function mergeReads(prev: ReadMap, entries: [string, string][]): ReadMap {
  let next = prev;
  for (const [id, ts] of entries) {
    if (isLater(ts, prev[id])) {
      if (next === prev) next = { ...prev };
      next[id] = ts;
    }
  }
  return next;
}
