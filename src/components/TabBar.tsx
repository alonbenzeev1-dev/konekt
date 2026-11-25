import { MapPin, MessageCircle, UserCheck, UserRound, type LucideIcon } from 'lucide-react';

export type Tab = 'radar' | 'chats' | 'requests' | 'profile';

/** RTL: the first item sits on the right. */
const ITEMS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'radar', label: 'סביבי', Icon: MapPin },
  { id: 'chats', label: 'צ׳אטים', Icon: MessageCircle },
  { id: 'requests', label: 'בקשות', Icon: UserCheck },
  { id: 'profile', label: 'פרופיל', Icon: UserRound },
];

export function TabBar({ tab, onTab, badges }: { tab: Tab; onTab: (t: Tab) => void; badges: Partial<Record<Tab, number>> }) {
  return (
    <nav aria-label="ניווט ראשי" className="sticky bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-xl safe-bottom">
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const badge = badges[id] ?? 0;
          return (
            <li key={id}>
              <button
                onClick={() => onTab(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={badge > 0 ? `${label}, ${badge} חדשים` : label}
                className="flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 active:opacity-70"
              >
                {/* the pill is the active indicator; the badge hangs off its top corner, same spot on every tab */}
                <span
                  className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? 'bg-primary-soft text-cta' : 'text-muted'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  {badge > 0 && (
                    <span dir="ltr" className="absolute -top-1.5 end-1 min-w-[18px] rounded-full bg-cta px-1 text-center text-[10px] leading-[18px] font-bold text-white tabular-nums ring-2 ring-card">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className={`max-w-full truncate text-[11px] leading-4 ${active ? 'font-bold text-cta' : 'font-medium text-muted'}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
