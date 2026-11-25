/** "מה הקטע שלך כרגע?": a live status, short enough to read at a glance. */
export const INTENT_MAX = 60;
/** The database stops returning an intent this long after it was set (see current_intent.sql). */
export const INTENT_TTL_MS = 8 * 3600_000;

/** Placeholder phrases: how a student at TAU would really say it. */
export const INTENT_PHRASES = [
  'מחפש מישהו לקפה קצר בין השיעורים...',
  'לומד עכשיו בספרייה, מוזמנים להצטרף...',
  'עובד על פרויקט AI ומחפש מישהו להתייעץ...',
  'בהפסקת צהריים בדשא, תגידו שלום...',
  'מחפש פרטנר ללמידה למבחנים...',
  'אשמח להכיר אנשים מעולמות היזמות וההייטק...',
] as const;

/** The status to show for a profile: set, and not older than the TTL (rows without a timestamp are treated as fresh). */
export function activeIntent(p: { current_intent?: string | null; current_intent_at?: string | null }, now = Date.now()): string | null {
  const text = p.current_intent?.trim();
  if (!text) return null;
  if (p.current_intent_at && now - Date.parse(p.current_intent_at) > INTENT_TTL_MS) return null;
  return text;
}

/** One-tap opener that quotes what they wrote. It only fills the message box; the person decides whether to send it. */
export const intentIcebreaker = (intent: string) => `היי, ראיתי שכתבת: ${intent.trim().replace(/[.…]+$/, '')} — רלוונטי?`;
