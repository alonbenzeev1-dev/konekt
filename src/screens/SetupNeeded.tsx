import { Wordmark } from '../components/Logo';

export function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark className="text-xl" />
      <h1 className="text-lg font-bold text-ink">חסרים מפתחות Supabase</h1>
      <p className="text-sm leading-relaxed text-muted" dir="ltr">
        Copy <code className="text-ink">.env.example</code> → <code className="text-ink">.env.local</code>, fill in{' '}
        <code className="text-ink">VITE_SUPABASE_URL</code> and <code className="text-ink">VITE_SUPABASE_ANON_KEY</code>, then restart{' '}
        <code className="text-ink">npm run dev</code>.
      </p>
    </div>
  );
}
