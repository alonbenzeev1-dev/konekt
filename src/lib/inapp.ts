const IN_APP: [RegExp, string][] = [
  [/WhatsApp/i, 'WhatsApp'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/Telegram/i, 'Telegram'],
];

/** Name of the app whose in-app browser we are running in (no saved passwords / FaceID there), or null. */
export function inAppBrowserName(ua: string = navigator.userAgent): string | null {
  return IN_APP.find(([re]) => re.test(ua))?.[1] ?? null;
}

/** Copy text; falls back to a hidden textarea because many in-app WebViews lack the async clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
