export function msLeft(iso: string, now = Date.now()): number {
  return Math.max(0, new Date(iso).getTime() - now);
}

/** 1:42:07 / 12:05 */
export function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "עוד 23 ש׳" style for chat expiry. */
export function formatHoursLeft(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `עוד ${h} ש׳`;
  return `עוד ${Math.max(1, Math.floor(ms / 60_000))} דק׳`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
