/** A small, curated set: what students actually send between lectures. No emoji library, no network. */
export interface EmojiCategory {
  id: string;
  label: string;
  /** Shown on the category tab. */
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'useful',
    label: 'שימושי',
    icon: '👍',
    emojis: ['👍', '👎', '👌', '🙏', '🙌', '👏', '💪', '🤝', '✅', '❌', '❓', '❗', '💯', '🔥', '🎉', '✨', '👋', '🤞', '👀', '📌', '📍', '⏰', '📅', '🚀', '💡', '🆗', '🔜', '🙋'],
  },
  {
    id: 'faces',
    label: 'פרצופים',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤓', '🤔', '🙄', '😴', '🥱', '😬', '🙈', '😭', '😤', '🥲', '🤯', '😇', '🤗', '😏'],
  },
  {
    id: 'campus',
    label: 'קפה ולימודים',
    icon: '☕',
    emojis: ['☕', '🥐', '🥪', '🍕', '🍔', '🍎', '🍫', '🧃', '💧', '📚', '📖', '📝', '✏️', '🎓', '💻', '🎧', '🔋', '📱', '🧠', '🏫', '🪑', '🌳', '☀️', '🌧️', '🧪', '📊', '🧮', '🗂️'],
  },
  {
    id: 'symbols',
    label: 'סימנים',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '⭐', '🌟', '⚡', '💬', '🔔', '🔒', '🔗', '➕', '➖', '➡️', '⬅️', '✔️', '⚠️', '🏆', '🎯', '🔄', '♾️', '🆕', '💫'],
  },
];
