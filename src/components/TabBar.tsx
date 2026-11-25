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
    <nav className="sticky bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-xl safe-bottom">
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const badge = badges[id] ?? 0;
          return (
            <li key={id}>
              <button
                onClick={() => onTab(id)}
                className={`relative flex w-full flex-col items-center gap-1 px-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-cta px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-card">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
