// Supabase Edge Function: sends Web Push when a message or connection request is inserted.
// Wire it up with a Database Webhook (see README §Push). Optional for Alpha —
// in-app alerts (toast + vibration) work without it while the app is open.
//
// Secrets needed (supabase secrets set …):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@uni.ac.il)
//   WEBHOOK_SECRET  (any random string; also set as the webhook's x-webhook-secret header)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@konekt.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, string>;
  old_record?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const body = (await req.json()) as WebhookPayload;
  const r = body.record;

  let to: string | null = null;
  let fromId: string | null = null;
  let payload: { title: string; body: string; tag: string; url: string } | null = null;

  const label = r.kind === 'linkedin' ? 'LinkedIn' : r.kind === 'instagram' ? 'Instagram' : 'צ׳אט';

  if (body.table === 'messages' && body.type === 'INSERT') {
    to = r.receiver_id;
    fromId = r.sender_id;
    payload = { title: 'הודעה חדשה', body: r.content.slice(0, 80), tag: `msg-${r.chat_id}`, url: '/?tab=chats' };
  } else if (body.table === 'connection_requests' && body.type === 'INSERT') {
    to = r.receiver_id;
    fromId = r.sender_id;
    // Chat requests: don't put the (not yet approved) first message on the lock screen.
    const what = r.kind === 'chat' ? 'רוצה להתחיל איתך צ׳אט' : `מבקש/ת את ה-${label} שלך`;
    payload = { title: 'בקשה חדשה', body: `${what} · שעתיים לאשר`, tag: `req-${r.id}`, url: '/?tab=requests' };
  } else if (body.table === 'connection_requests' && body.type === 'UPDATE' && r.status === 'accepted' && body.old_record?.status === 'pending') {
    to = r.sender_id;
    fromId = r.receiver_id;
    payload = {
      title: 'הבקשה אושרה!',
      body: r.kind === 'chat' ? 'הצ׳אט פתוח ל-24 שעות' : `ה-${label} נחשף — פתחו את KONEKT`,
      tag: `acc-${r.id}`,
      url: r.kind === 'chat' ? '/?tab=chats' : '/?tab=requests',
    };
  }
  if (!to || !payload) return new Response('ignored');

  if (fromId) {
    const { data: from } = await supabase.from('profiles').select('first_name').eq('id', fromId).single();
    if (from?.first_name) {
      if (body.table === 'messages') payload.title = `הודעה מ${from.first_name}`;
      else if (body.type === 'INSERT') payload.body = `${from.first_name} ${payload.body}`;
      else payload.body = `${from.first_name} אישר/ה · ${payload.body}`;
    }
  }

  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', to);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 7200 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }),
  );
  return new Response('ok');
});
