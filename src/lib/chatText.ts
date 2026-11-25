/** One line of text standing in for a message wherever the bubble itself cannot be shown (list preview, pin bar, sheets). */
export function messagePreview(m: { kind?: string; content: string }): string {
  if (m.kind === 'poll') return `סקר: ${m.content}`;
  if (m.kind === 'linkedin') return 'כרטיס LinkedIn';
  return m.content;
}

/** The first web link inside a message (http/https only), for "open the link" on a pinned message. */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0].replace(/[.,;:!?)\]]+$/, ''));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
