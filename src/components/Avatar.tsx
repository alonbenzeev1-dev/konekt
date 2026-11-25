interface Props {
  url: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  live?: boolean;
}

export function Avatar({ url, name, size = 56, ring = false, live = false }: Props) {
  const dot = Math.max(10, Math.round(size * 0.24));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className={`block h-full w-full overflow-hidden rounded-full bg-primary-soft shadow-sm ${
          ring ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : 'ring-1 ring-line'
        }`}
      >
        {url ? (
          <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" draggable={false} referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-extrabold text-cta-press" style={{ fontSize: size * 0.38 }}>
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      {live && (
        <span
          className="absolute bottom-0 left-0 rounded-full border-2 border-card bg-live anim-live"
          style={{ width: dot, height: dot }}
          aria-label="פעיל עכשיו"
        />
      )}
    </span>
  );
}
