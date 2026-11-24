# KONEKT — פשוט תתחברו.

Mobile-first PWA for live, person-to-person networking on campus (75 m radar).
Vite + React 19 + TypeScript + Tailwind v4 + Supabase (Postgres, Realtime, Storage, Edge Functions) + LinkedIn sign-in.

## 1. Database (Supabase → SQL Editor)

Paste all of `supabase_schema.sql` and click **Run**. It works on a fresh project **and** upgrades a project that ran the v1 Alpha schema:
- Profiles are kept. `is_active` becomes `is_visible`, and LinkedIn links are normalized.
- **v1 chat messages are deleted**, because they have no approved chat behind them.
- The script is safe to re-run.

Recommended: **Database → Extensions → pg_cron**, then run the last commented line of the SQL. Cleanup then runs every 5 min: it deletes chats older than 24 h, expires lapsed requests, and forgets the coordinates of people inactive for 10+ min.

## 2. LinkedIn sign-in

1. On developers.linkedin.com, choose **Create app**. LinkedIn requires a company Page to attach it to.
2. Under **Products**, add **Sign In with LinkedIn using OpenID Connect**.
3. Under **Auth → Authorized redirect URLs**, add `https://<project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase → **Authentication → Sign In / Providers → LinkedIn (OIDC)**: turn it on and paste the Client ID and Client Secret. The secret goes there only, never into `.env.local`.
5. In Supabase → **Authentication → URL Configuration**: set the Site URL to your deployed URL, and add `http://localhost:5173` under Redirect URLs.
6. Optional: turn **Anonymous sign-ins** off. v2 doesn't use them.

LinkedIn's OpenID Connect sign-in only shares **name, photo and email**. Headline and profile URL require restricted partner permissions, so users paste their LinkedIn URL and type a short headline on the screen right after login.

## 3. Copy LinkedIn photos to Storage (Edge Function)

LinkedIn photo URLs expire, so `supabase/functions/import-avatar` copies the photo into the `avatars` bucket on first login. Deploy it with:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy import-avatar
```

You can also use Dashboard → Edge Functions → Deploy a new function → Via Editor, name it `import-avatar`, and paste the file. Keep **Verify JWT** on.

If the function isn't deployed, the app tries copying the photo from the browser instead. If that's blocked too, the user can upload a photo from their profile.

## 4. Run

```bash
cp .env.example .env.local   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Project Settings → API)
npm install
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build → dist/
```

**Deploy:** with the Vercel CLI, run `npx vercel login`, `npx vercel build --prod`, then `npx vercel deploy --prebuilt --prod`. Or import the repo in Vercel and set the two `VITE_` variables there. GPS needs HTTPS on phones.

Push notifications for a closed app (optional): see `supabase/functions/push`. Create Database Webhooks for `messages` (Insert) and `connection_requests` (Insert + Update), with the header `x-webhook-secret`.

## Privacy model

| Rule | Where it's enforced |
|---|---|
| Radar shows visible users ≤75 m who pinged in the last 10 min | `get_nearby_users` (radius capped server-side) |
| You can't search a location you're not at | Caller must be visible, pinged ≤5 min ago, query within 150 m of their own position |
| Links never leave the server unless approved | `profiles` RLS = own row only; `get_connection_link` = sender only, after approval |
| Chat is double opt-in | First message is a `chat` request; `respond_request` opens a 24 h chat; `send_message` only works in an open chat |
| "התעלם / חסום" is mutual, permanent and silent | `blocks` table, checked in every function and policy. The blocked person's request keeps "pending" until it times out, so it looks like no answer. |
| Campus count | `get_campus_count`: a number only, visible users within 1 km |

Clients cannot write to `connection_requests`, `chats`, `messages` or `blocks` directly; all writes go through the functions.

## Structure

```
src/
  App.tsx              welcome → complete profile → main (radar / inbox / profile + chat)
  screens/             Welcome, CompleteProfile, Radar (+ empty state & WhatsApp invite), Inbox, Chat, Profile
  hooks/               usePresence (GPS + 60 s heartbeat), useNearby (radar + campus count), useInbox (Realtime)
  components/          VisibilityToggle, Avatar, BottomSheet, LinkFields, PhotoPicker, TabBar, Toaster, Logo
  lib/                 supabase (LinkedIn OIDC), profile/avatars, social links + WhatsApp invite, notify, time
supabase/functions/    import-avatar (LinkedIn photo → Storage), push (Web Push)
```

## Known trade-offs

- **Contrast:** buttons, badges and your own chat bubbles use `#0284C7` (4.1:1 with white): fine for the bold button labels, slightly under the 4.5:1 ideal for small text. `#0369A1` would be 5.9:1. Cyan `#00AEEF` is kept for accents (logo, radar, icons, highlights).
- **Blocking mid-chat deletes the chat for both people**, so the other person can tell something happened. This follows the "mutual and permanent" rule. Blocks from a request or the radar stay silent.
- Accepting a request reveals the link only to the requester, not both ways. To share yours too, send your own request.
- GPS spoofing can't be prevented in the browser; the anti-probing check stops casual abuse only.
