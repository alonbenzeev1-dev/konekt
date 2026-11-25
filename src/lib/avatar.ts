/** Curated, friendly hues (sky, indigo, violet, pink, coral, amber, emerald, teal): no muddy yellow-greens. */
const HUES = [199, 222, 262, 330, 14, 36, 160, 182];

/**
 * A stable tint per name, so the same person always gets the same avatar and neighbours in a list differ.
 * Soft two-tone gradient behind dark text of the same hue (about 9:1 contrast).
 */
export function avatarTint(name: string): { background: string; color: string } {
  let h = 0x811c9dc5; // FNV-1a over code points (works for Hebrew and Latin)
  for (const ch of name.trim().toLowerCase()) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  const hue = HUES[h % HUES.length];
  const hue2 = (hue + ((h >>> 8) % 3) * 10 - 10 + 360) % 360; // a little drift so the gradient is not flat
  return {
    background: `linear-gradient(135deg, hsl(${hue} 92% 94%), hsl(${hue2} 86% 84%))`,
    color: `hsl(${hue} 62% 24%)`,
  };
}

/** First letter for the initials fallback (first code point, so emoji / combining marks do not split). */
export const initialOf = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase();
