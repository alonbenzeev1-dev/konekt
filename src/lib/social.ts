import type { RequestKind } from './types';

/** Accepts "linkedin.com/in/x", "https://il.linkedin.com/in/x/?utm=…" → "https://www.linkedin.com/in/x" or null. */
export function normalizeLinkedIn(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (/^in\//i.test(v)) v = 'linkedin.com/' + v;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/in\/([^/?#]+)\/?$/i);
    if (!m) return null;
    return `https://www.linkedin.com/in/${m[1]}`;
  } catch {
    return null;
  }
}

/** Accepts "@name", "name", "instagram.com/name" → "name" or null. */
export function normalizeInstagram(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export const kindLabel: Record<RequestKind, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  chat: 'צ׳אט',
};

export function whatsappInviteUrl(): string {
  const text = `היי! אני על KONEKT — רואים מי נמצא סביבך עכשיו בקמפוס ומתחברים בקליק. פשוט תתחברו 👇\n${window.location.origin}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
