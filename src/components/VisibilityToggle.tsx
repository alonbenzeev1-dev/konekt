interface Props {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

/** Top visibility toggle — "גלוי בסביבה" / "מוסתר" (profiles.is_visible) */
export function VisibilityToggle({ on, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'גלוי בסביבה — לחצו כדי להסתתר' : 'מוסתר — לחצו כדי להופיע בסביבה'}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 rounded-full border py-1.5 ps-2.5 pe-1.5 transition-all duration-200 disabled:opacity-50 ${
        on ? 'border-live/40 bg-live-soft' : 'border-line bg-card'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap ${on ? 'text-[#047857]' : 'text-muted'}`}>
        <span className={`h-2 w-2 rounded-full ${on ? 'bg-live anim-live' : 'bg-muted/50'}`} />
        {on ? 'גלוי בסביבה' : 'מוסתר'}
      </span>
      <span className={`relative h-7 w-11 rounded-full transition-colors duration-200 ${on ? 'bg-live' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-1' : 'left-5'}`} />
      </span>
    </button>
  );
}
