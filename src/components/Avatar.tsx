import { avatarTint, initialOf } from '../lib/avatar';

interface Props {
  url: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  live?: boolean;
}

export function Avatar({ url, name, size = 56, ring = false, live = false }: Props) {
  const dot = Math.max(10, Math.round(size * 0.24));
  const tint = avatarTint(name);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className={`block h-full w-full overflow-hidden rounded-full shadow-sm ${
          ring ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : 'ring-1 ring-black/5'
        }`}
        style={url ? undefined : { background: tint.background }}
      >
        {url ? (
          <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" draggable={false} referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-extrabold" style={{ fontSize: size * 0.4, color: tint.color }}>
            {initialOf(name)}
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
