import type { RequestKind } from './types';

/** Direction marks, zero-width chars, soft hyphens: invisible, but they break URLs pasted from WhatsApp / Hebrew text. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD]/g;

/** Strips invisible characters, NBSPs and quotes / <brackets> a link often arrives wrapped in. */
const clean = (s: string) =>
  s
    .replace(INVISIBLE, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/^[<(\["'“‘]+|[>)\]"'”’]+$/g, '')
    .trim();

/** "dana-cohen", "in/dana-cohen", "/in/dana-cohen/": a profile slug on its own (LinkedIn slugs are 3-100 chars). */
const BARE_SLUG = /^\/?(?:in\/)?([\p{L}\p{N}\-_%]{3,100})\/?$/u;

/**
 * Anything a person might paste → the one canonical form we store: "https://www.linkedin.com/in/<slug>", or null.
 *   https://www.linkedin.com/in/dana/  ·  http://linkedin.com/in/dana?utm_source=share  ·  il.linkedin.com/in/dana/en
 *   www.linkedin.com/in/dana/details/experience/  ·  in/dana  ·  dana
 * Always absolute https, never doubled, query / extra path dropped. The "me" shortcut is not a real profile.
 */
export function normalizeLinkedIn(input: string): string | null {
  // trailing punctuation can sit outside a closing quote ("…/in/dana".), so clean again after stripping it
  let v = clean(clean(input).replace(/[.,;:!?]+$/, ''));
  if (!v) return null;
  // a value pasted on top of one that was already there: ".../in/https://www.linkedin.com/in/dana" → keep the last link
  const hits = [...v.matchAll(/linkedin\.com\/in\//gi)];
  if (hits.length > 1) v = v.slice(hits[hits.length - 1].index);

  let slug: string | null = null;
  const bare = v.match(BARE_SLUG);
  if (bare) {
    slug = bare[1].replace(/[^\x00-\x7F]+/g, (c) => encodeURIComponent(c)); // Hebrew slug → %-encoded, like a URL would be
  } else {
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return null; // linkedin://, mailto:, javascript: …
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, ''));
      if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
      slug = u.pathname.match(/^\/in\/([^/]+)/i)?.[1] ?? null; // first path segment only
    } catch {
      return null;
    }
  }
  if (!slug || slug.length < 3 || slug.length > 300 || slug.toLowerCase() === 'me' || /[:@]/.test(slug)) return null;
  return `https://www.linkedin.com/in/${slug}`;
}

/** Finds a LinkedIn profile link inside arbitrary clipboard text ("Check out my profile https://…"). */
export function extractLinkedIn(text: string): string | null {
  const m = clean(text).match(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/[^\s/?#<>"')\]]+/i);
  return m ? normalizeLinkedIn(m[0]) : null;
}

const IG_RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct']);

/** Accepts "@name", "name", "name/", "instagram.com/name/?hl=he" → "name" or null (post / reel links are not handles). */
export function normalizeInstagram(input: string): string | null {
  let v = clean(input);
  if (!v) return null;
  const m = v.match(/instagram\.com\/(?:_u\/)?([^/?#\s]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, '').replace(/\/+$/, '');
  if (IG_RESERVED.has(v.toLowerCase())) return null;
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

/**
 * Last line of defence before a link goes into an <a href>: re-canonicalise whatever the server returned.
 * Returns null for anything that is not a LinkedIn / Instagram profile (so nothing odd is ever rendered as a link).
 */
export function safeProfileUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/linkedin\.com/i.test(raw)) return normalizeLinkedIn(raw);
  if (/instagram\.com/i.test(raw)) {
    const h = normalizeInstagram(raw);
    return h ? instagramUrl(h) : null;
  }
  return null;
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
