import { createClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'konekt-auth',
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

/** Primary login. Supabase provider: "LinkedIn (OIDC)". */
export async function signInWithLinkedIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

/** Name + photo from LinkedIn's OIDC claims. LinkedIn does not share headline or profile URL. */
export function linkedInIdentity(user: User): { firstName: string; picture: string | null } {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  const idData = (user.identities?.find((i) => i.provider === 'linkedin_oidc')?.identity_data ?? {}) as Record<string, unknown>;
  const pick = (...vals: unknown[]) => vals.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const full = pick(m.full_name, m.name, idData.name) ?? '';
  const firstName = (pick(m.given_name, idData.given_name) ?? full.split(/\s+/)[0] ?? '').slice(0, 30);
  const picture = pick(m.picture, m.avatar_url, idData.picture) ?? null;
  return { firstName, picture };
}
