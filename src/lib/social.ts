import type { RequestKind } from './types';

const SLUG = /^[\p{L}\p{N}\-_%]+$/u;

/**
 * Accepts "linkedin.com/in/x", "https://il.linkedin.com/in/x/?utm=…" or just the slug "x"
 * → "https://www.linkedin.com/in/x" or null. The "me" shortcut is not a real profile and is rejected.
 */
export function normalizeLinkedIn(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (SLUG.test(v)) v = 'linkedin.com/in/' + v; // bare slug
  else if (/^in\//i.test(v)) v = 'linkedin.com/' + v;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/in\/([^/?#]+)\/?$/i);
    if (!m || m[1].toLowerCase() === 'me') return null;
    return `https://www.linkedin.com/in/${m[1]}`;
  } catch {
    return null;
  }
}

/** Finds a LinkedIn profile link inside arbitrary clipboard text ("Check out my profile https://…"). */
export function extractLinkedIn(text: string): string | null {
  const m = text.match(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/[^\s/?#]+/i);
  return m ? normalizeLinkedIn(m[0]) : null;
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

export const APP_URL = 'https://konekt-nu.vercel.app';
const INVITE_TEXT = 'היי! אני על KONEKT: רואים מי נמצא סביבך עכשיו בקמפוס ומתחברים בקליק. פשוט תתחברו 👇';

/** Mobile: native share sheet. Elsewhere (or if sharing fails): copy the invite and say so. */
export async function inviteNearby(notify: (text: string, kind: 'success' | 'error') => void): Promise<void> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text: INVITE_TEXT, url: APP_URL });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the sheet
  }
  try {
    await navigator.clipboard.writeText(`${INVITE_TEXT}
${APP_URL}`);
    notify('ההזמנה הועתקה — אפשר להדביק ולשלוח', 'success');
  } catch {
    notify('לא הצלחנו להעתיק את ההזמנה', 'error');
  }
}

export function whatsappInviteUrl(): string {
  const text = `היי! אני על KONEKT — רואים מי נמצא סביבך עכשיו בקמפוס ומתחברים בקליק. פשוט תתחברו 👇\n${window.location.origin}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
