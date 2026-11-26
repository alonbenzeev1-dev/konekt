# Konekt

Proximity networking PWA (Hebrew, RTL): see who is within 400 m (active in the last 45 min), then request a chat, LinkedIn or Instagram.

## Stack
React 19 + TypeScript (strict) + Vite 6 + Tailwind 4, lucide-react icons, Supabase (Postgres/RLS, Realtime, Storage, Edge Functions). Deployed on Vercel from `main`.
Commands: `npm run dev`, `npm run build` (`tsc -b && vite build`; must be clean before pushing).

## Layout
- `src/App.tsx` boot/auth flow and tab shell
- `src/screens/` Radar (nearby + person sheet), ChatsScreen (1-on-1 + groups), RequestsScreen (incoming, approved links, sent), Chat, GroupChat, Profile, CompleteProfile, Welcome
- `src/hooks/` useInbox (requests/chats/messages + Realtime), useNearby, usePresence, useConnectionLink
- `src/lib/` supabase client, types, social helpers, profile helpers
- `supabase_schema.sql` full schema, RLS and RPCs (paste into SQL Editor; safe to re-run)
- `supabase/migrations/private_groups.sql` private groups (groups, group_members, group_messages + RPCs); apply after the main schema
- `supabase/migrations/read_state.sql` server-side read state: group_members.last_read_at, chat_reads, mark_chat_read / mark_group_read
- `supabase/migrations/mutual_approval.sql` respond_request(request_id, accept, share_back)
- `supabase/migrations/rooms_invites.sql` groups become rooms: description + place, invite_code (QR / ?join=<code>), 200 members, LinkedIn cards (share_linkedin_in_group), separate share_instagram
- `supabase/migrations/chat_engagement.sql` message_reactions (direct + room, one per person), quick polls (group_polls / options / votes), groups.pinned_message_id, realtime publication; all writes via RPCs (react_to_message, create_group_poll, vote_group_poll, pin_group_message)
- `supabase/migrations/wave1_radar_invites.sql` get_nearby_users (400 m, 45 min, active_minutes), get_campus_count (400 m-2 km), konekt_cleanup (wipes coordinates after 45 min), groups.invites_locked + reset_group_invite / set_group_invites_locked, preview/join respect the lock
- `supabase/migrations/wave2_chat_indexes.sql` indexes on the RLS / filter columns (chats, messages, rooms, reactions, votes, radar) + realtime publication re-assert
- `supabase/migrations/current_intent.sql` profiles.current_intent (+ current_intent_at set by a trigger); get_nearby_users / get_group_members / get_public_profiles return it while fresh (8 h)
- `supabase/migrations/campus_tags.sql` profiles.tags (max 3) + get_nearby_users returning tags
- `supabase/functions/` import-avatar, push

## Request logic (one-way, 48h)
- Other users' profile rows are never readable (RLS: own row only). Everything goes through SECURITY DEFINER RPCs.
- `send_request(target, kind)` creates a request (pending for 2 h). The receiver approves with `respond_request`.
- Approval is ONE-WAY by default: only the sender can fetch the receiver's link, via `get_connection_link(request_id)`.
- "אשר ושתף גם את שלי" = `respond_request(..., share_back := true)`: also records an already-approved request from the approver to the requester (if they have that link), so both can open each other's link. Requesters are told this on the send sheet.
- To get the other person's link back, the receiver must send their own request ("בקש גם ... חזרה" on the Inbox link card).
- The client loads only the last 48 h of requests, so approved links older than that disappear from the UI.
- Blocks are mutual, permanent and silent.

## Radar
- Main list: 400 m, last seen within 45 min. "קצת יותר רחוק" = 400 m to 2 km (a count only). Cards show a label, never meters: <=60 m "ממש לידך", <=150 m "בבניין / באזור", else "בקמפוס"; plus "פעיל עכשיו" (<=10 min) or "לפני X דק׳". Constants: RADIUS_M / CAMPUS_RADIUS_M in useNearby.ts; the 400 and 45 also live in wave1_radar_invites.sql.

- Ranking (src/lib/ranking.ts, client-side): status +20 (+10 if it shares a keyword with mine), shared room +15, proximity 30 (flat to 60 m, 20 at 150, 5 at 400), freshness 20 (flat to 10 min, 0 at 45). Radar tiers: "במוקד עכשיו" (top 5 with a status or shared room, rich cards), filter pills, compact rows for the rest.

## Live status ("מה הקטע שלך כרגע?")
- Max 60 chars, shown on nearby cards, in room member lists and as a one-tap opener (fills the message box, never sends). It expires 8 h after it was set: the 8 h lives in current_intent.sql and in INTENT_TTL_MS (src/lib/intent.ts). Edit it with <TypewriterInput> (typewriter placeholder; respects reduced motion).

## Chat engagement
- Realtime: every table a chat listens to must be in the supabase_realtime publication. Never subscribe to DELETE on tables with RLS (Realtime does not filter DELETE): removing a reaction is an UPDATE to NULL, votes can only change.
- Scrolling: useStickToBottom keeps you at the bottom only if you were already near it (or you sent the message); otherwise a "new messages" button appears.
- Typing indicator: Realtime Broadcast (useTyping, channel typing:chat:<id> / typing:room:<id>), ephemeral, no DB. Anyone who knows the id could listen; the payload is only a user id.
- Message actions (tap / long-press a bubble): six quick reactions, plus "pin" for the room creator.

## Rooms and invites
- Invite URL is `https://konekt-nu.vercel.app/?join=<code>` (fixed origin). `capturePendingJoin()` (src/lib/invite.ts) stores the code in localStorage on first load and strips it from the URL, so it survives the LinkedIn redirect and onboarding. A brand-new member who arrived through an invite auto-joins; anyone else gets a one-tap "join this room?" card (`JoinInvite`).
- Members always see each other's name, photo and headline (get_group_members does not look at is_visible); LinkedIn / Instagram only where that member shared them in that room.

## Requests screen windows
- Pending: 2 h. Active (links open): 48 h from the request. History: expired requests and links older than 48 h, loaded for 7 days (src/lib/requests.ts has the one definition of each window).

## Conventions
- Profile links are stored canonical: `https://www.linkedin.com/in/<slug>` and a bare Instagram handle (DB check constraints enforce it). Always go through `normalizeLinkedIn` / `normalizeInstagram` on input and `safeProfileUrl` before putting a server value in an `<a href>` (src/lib/social.ts).
- Source files use CRLF line endings.
- `.env.local` holds Supabase keys and must never be committed (`.env.example` is the template).
