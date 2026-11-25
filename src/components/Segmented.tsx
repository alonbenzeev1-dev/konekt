export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  /** Unread / pending count for this segment only (0 or undefined = no badge). */
  badge?: number;
}

/** Two or three mutually exclusive views of one screen. RTL: the first option sits on the right. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fit = 'equal',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** 'equal': same width each. 'content': width follows the label (three segments with one long name). */
  fit?: 'equal' | 'content';
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-2xl bg-line/60 p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex min-h-[44px] min-w-0 ${fit === 'equal' ? 'flex-1' : 'flex-auto'} items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors duration-150 ${
              active ? 'bg-card font-bold text-ink shadow-sm' : 'font-medium text-ink/65 active:bg-card/50'
            }`}
          >
            <span className="truncate">{o.label}</span>
            {!!o.badge && (
              <span dir="ltr" className="min-w-[18px] shrink-0 rounded-full bg-cta px-1.5 text-center text-[11px] leading-[18px] font-bold text-white tabular-nums">
                {o.badge > 9 ? '9+' : o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
