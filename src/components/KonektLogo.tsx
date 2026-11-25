import { useId } from 'react';

/** Konekt brand mark: a "K" whose arms end in live nodes, with signal waves in its crook. Transparent background. */
export function KonektLogo({ className = 'h-7 w-7' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const k = `k${uid}`;
  const w = `w${uid}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={k} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={w} x1="32" y1="32" x2="46" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect x="10" y="8" width="10" height="48" rx="5" fill={`url(#${k})`} />
      <path d="M18 32 46 12M18 32 46 52" fill="none" stroke={`url(#${k})`} strokeWidth="9" strokeLinecap="round" />
      <circle cx="46" cy="12" r="7.5" fill={`url(#${k})`} />
      <circle cx="46" cy="12" r="3.6" fill="#10B981" />
      <circle cx="46" cy="52" r="7.5" fill={`url(#${k})`} />
      <circle cx="46" cy="52" r="3.6" fill="#10B981" />
      <circle cx="32" cy="32" r="2.6" fill="#10B981" />
      <g fill="none" stroke={`url(#${w})`} strokeWidth="2.6" strokeLinecap="round">
        <path d="M37.4 27.5A7 7 0 0 1 37.4 36.5" />
        <path d="M41.2 24.3A12 12 0 0 1 41.2 39.7" />
        <path d="M45 21.1A17 17 0 0 1 45 42.9" />
      </g>
    </svg>
  );
}
