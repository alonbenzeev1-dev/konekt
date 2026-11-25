import { APP_URL } from './social';

const KEY = 'konekt_pending_join';
const AUTO_KEY = 'konekt_pending_join_auto';
const CODE = /^[a-z0-9]{6,32}$/i;

/** https://konekt-nu.vercel.app/?join=<code> (fixed origin, so a QR printed from a preview build still works). */
export const inviteUrl = (code: string) => `${APP_URL}/?join=${encodeURIComponent(code)}`;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const getPendingJoin = (): string | null => read(KEY);

/**
 * Read ?join=<code> once, remember it (it has to survive the LinkedIn redirect and onboarding, which both
 * reload the page without the query string), and clean the address bar. Returns the code waiting to be used.
 */
export function capturePendingJoin(): string | null {
  try {
    const url = new URL(location.href);
    const raw = url.searchParams.get('join');
    if (raw !== null) {
      url.searchParams.delete('join');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      const code = raw.trim();
      if (CODE.test(code)) localStorage.setItem(KEY, code.toLowerCase());
    }
  } catch {
    /* storage blocked: the invite simply cannot be carried across sign-in */
  }
  return getPendingJoin();
}

export function clearPendingJoin() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(AUTO_KEY);
  } catch {
    /* noop */
  }
}

/** A brand-new member arrived through an invite: skip the "join?" prompt, they already said yes by signing up for it. */
export function markJoinAuto() {
  try {
    if (localStorage.getItem(KEY)) localStorage.setItem(AUTO_KEY, '1');
  } catch {
    /* noop */
  }
}
export const isJoinAuto = () => read(AUTO_KEY) === '1';
