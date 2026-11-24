// Supabase Edge Function: copies the signed-in user's LinkedIn photo into the
// "avatars" bucket (LinkedIn photo URLs expire) and saves it on their profile.
// Deploy: supabase functions deploy import-avatar   (JWT verification ON — the default)
//
// The photo URL is taken from the user's own LinkedIn identity on the server,
// never from the request body, and only LinkedIn's CDN is allowed.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const ident = (user.identities?.find((i) => i.provider === 'linkedin_oidc')?.identity_data ?? {}) as Record<string, unknown>;
  const picture = [meta.picture, meta.avatar_url, ident.picture].find((v): v is string => typeof v === 'string' && v.length > 0);
  if (!picture) return json({ error: 'no linkedin photo' }, 404);

  let url: URL;
  try {
    url = new URL(picture);
  } catch {
    return json({ error: 'bad photo url' }, 400);
  }
  if (url.protocol !== 'https:' || !/(^|\.)licdn\.com$/i.test(url.hostname)) return json({ error: 'photo host not allowed' }, 400);

  const res = await fetch(url, { redirect: 'error' }); // never follow off the LinkedIn CDN
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return json({ error: 'photo download failed' }, 502);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 2_000_000) return json({ error: 'photo too large' }, 413);

  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const path = `${user.id}/linkedin-${Date.now()}.${ext}`;
  const up = await admin.storage.from('avatars').upload(path, bytes, { contentType: type.split(';')[0], cacheControl: '31536000' });
  if (up.error) return json({ error: up.error.message }, 500);

  const avatar_url = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const upd = await admin.from('profiles').update({ avatar_url }).eq('id', user.id);
  if (upd.error) return json({ error: upd.error.message }, 500);

  return json({ avatar_url });
});
