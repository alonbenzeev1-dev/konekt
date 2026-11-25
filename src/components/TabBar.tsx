import { MapPin, MessagesSquare, UserRound } from 'lucide-react';

export type Tab = 'radar' | 'inbox' | 'profile';

export function TabBar({ tab, onTab, badge }: { tab: Tab; onTab: (t: Tab) => void; badge: number }) {
  const items: { id: Tab; label: string; Icon: typeof MapPin }[] = [
    { id: 'radar', label: 'סביבי', Icon: MapPin },
    { id: 'inbox', label: 'בקשות וצ׳אט', Icon: MessagesSquare },
    { id: 'profile', label: 'הפרופיל שלי', Icon: UserRound },
  ];
  return (
    <nav className="sticky bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-xl safe-bottom">
      <ul className="grid grid-cols-3">
        {items.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button
                onClick={() => onTab(id)}
                className={`relative flex w-full flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  {id === 'inbox' && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] rounded-full bg-cta px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-card">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
