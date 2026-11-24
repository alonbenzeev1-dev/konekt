export function Logo({ size = 28, pulse = true }: { size?: number; pulse?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      {pulse && <span className="absolute inset-0 rounded-full border border-primary/60 anim-ping" />}
      <span className="absolute inset-[12%] rounded-full border border-primary/30" />
      <span className="rounded-full bg-primary" style={{ width: size * 0.36, height: size * 0.36 }} />
    </span>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span dir="ltr" className={`inline-flex items-center gap-2 font-extrabold tracking-[0.16em] text-ink ${className}`}>
      <Logo size={22} />
      KONEKT
    </span>
  );
}
