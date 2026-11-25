# Konekt

Proximity networking PWA (Hebrew, RTL): see who is within ~75 m, then request a chat, LinkedIn or Instagram.

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
- `supabase/migrations/campus_tags.sql` profiles.tags (max 3) + get_nearby_users returning tags
- `supabase/functions/` import-avatar, push

## Request logic (one-way, 48h)
- Other users' profile rows are never readable (RLS: own row only). Everything goes through SECURITY DEFINER RPCs.
- `send_request(target, kind)` creates a request (pending for 2 h). The receiver approves with `respond_request`.
- Approval is ONE-WAY: only the sender can fetch the receiver's link, via `get_connection_link(request_id)`.
- To get the other person's link back, the receiver must send their own request ("בקש גם ... חזרה" on the Inbox link card).
- The client loads only the last 48 h of requests, so approved links older than that disappear from the UI.
- Blocks are mutual, permanent and silent.

## Conventions
- Source files use CRLF line endings.
- `.env.local` holds Supabase keys and must never be committed (`.env.example` is the template).
