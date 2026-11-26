// Supabase Edge Function: Web Push for KONEKT, called by Database Webhooks.
//   connection_requests INSERT (pending)            -> notify receiver_id
//   connection_requests UPDATE pending -> accepted  -> notify sender_id
//   messages INSERT                                 -> notify receiver_id
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//   WEBHOOK_SECRET   random string, also sent by the webhooks as the x-webhook-secret header
//   APP_URL          optional, default https://konekt-nu.vercel.app (links in notifications must be absolute)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// The payload works for both kinds of subscriber:
//   - iOS 18.4+ Declarative Web Push: `web_push: 8030` + `notification: { title, navigate, ... }`
//     (Safari shows it by itself, even without running our service worker);
//   - every other browser: plain title / body / url / tag, read by public/sw.js.
// Both carry the same tag, so a device that handles both shows one notification, not two.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://konekt-nu.vercel.app').replace(/\/+$/, '');

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@konekt.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, string>;
  old_record?: Record<string, string> | null;
}

interface Note {
  title: string;
  body: string;
  tag: string;
  url: string; // absolute
}

const kindLabel = (k: string) => (k === 'linkedin' ? 'LinkedIn' : k === 'instagram' ? 'Instagram' : 'צ׳אט');
const link = (path: string) => `${APP_URL}${path}`;

/** One JSON that both iOS 18.4+ (declarative) and the service worker understand. */
function toPayload(n: Note) {
  return {
    web_push: 8030,
    notification: { title: n.title, body: n.body, navigate: n.url, tag: n.tag, lang: 'he', dir: 'rtl' },
    title: n.title,
    body: n.body,
    tag: n.tag,
    url: n.url,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });

  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const r = body.record;
  if (!r) return new Response('ignored');

  let to: string | null = null;
  let fromId: string | null = null;
  let note: Note | null = null;

  if (body.table === 'messages' && body.type === 'INSERT') {
    to = r.receiver_id;
    fromId = r.sender_id;
    note = { title: 'הודעה חדשה', body: String(r.content ?? '').slice(0, 80), tag: `msg-${r.chat_id}`, url: link(`/?tab=chats&chat=${r.chat_id}`) };
  } else if (body.table === 'connection_requests' && body.type === 'INSERT' && r.status === 'pending') {
    to = r.receiver_id;
    fromId = r.sender_id;
    // a chat request's first message stays off the lock screen: it is not approved yet
    const what = r.kind === 'chat' ? 'רוצה להתחיל איתך צ׳אט' : `מבקש/ת את ה-${kindLabel(r.kind)} שלך`;
    note = { title: 'בקשה חדשה', body: `${what} · שעתיים לאשר`, tag: `req-${r.id}`, url: link('/?tab=requests') };
  } else if (body.table === 'connection_requests' && body.type === 'UPDATE' && r.status === 'accepted' && body.old_record?.status === 'pending') {
    to = r.sender_id;
    fromId = r.receiver_id;
    note = {
      title: 'הבקשה אושרה!',
      body: r.kind === 'chat' ? 'הצ׳אט פתוח ל-24 שעות' : `ה-${kindLabel(r.kind)} נחשף. פתחו את KONEKT`,
      tag: `acc-${r.id}`,
      url: link(r.kind === 'chat' ? '/?tab=chats' : '/?tab=requests'),
    };
  }
  if (!to || !note) return new Response('ignored');

  if (fromId) {
    const { data: from } = await supabase.from('profiles').select('first_name').eq('id', fromId).maybeSingle();
    if (from?.first_name) {
      if (body.table === 'messages') note.title = `הודעה מ${from.first_name}`;
      else if (body.type === 'INSERT') note.body = `${from.first_name} ${note.body}`;
      else note.body = `${from.first_name} אישר/ה · ${note.body}`;
    }
  }

  const { data: subs, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', to);
  if (error) return new Response('db error', { status: 500 });

  const payload = JSON.stringify(toPayload(note));
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 7200, urgency: 'high' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint); // unsubscribed / expired: forget it
        else console.warn('push failed', code, s.endpoint.slice(0, 40));
      }
    }),
  );
  if (gone.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', gone);

  return new Response(JSON.stringify({ sent, removed: gone.length }), { headers: { 'content-type': 'application/json' } });
});
