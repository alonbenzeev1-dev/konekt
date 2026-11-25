import { useState } from 'react';
import { Bell } from 'lucide-react';
import { requestNotificationPermission, subscribeToPush, toast } from '../lib/notify';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Header bell: only while the browser has not been asked yet. Must be tapped (permission needs a gesture). */
export function NotificationBell({ userId }: { userId: string }) {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => (supported() ? Notification.permission : 'unsupported'));
  if (perm !== 'default') return null;

  const ask = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === 'granted') {
      void subscribeToPush(userId);
      toast('מעולה! נתריע לך על בקשות והודעות חדשות', 'success');
    } else if (result === 'denied') {
      toast('ההתראות חסומות. אפשר להפעיל אותן בהגדרות הדפדפן.', 'info');
    }
  };

  return (
    <button
      onClick={ask}
      aria-label="הפעלת התראות"
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors active:bg-bg"
    >
      <Bell size={19} />
      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-cta ring-2 ring-card" />
    </button>
  );
}
