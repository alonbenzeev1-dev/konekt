-- =====================================================================
--  KONEKT — Web Push: one row per browser / device that agreed to notifications.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--  Requires: supabase_schema.sql (profiles). Older databases already have a
--  push_subscriptions table (endpoint, user_id, p256dh, auth, created_at): this file upgrades it in place.
--
--  Only the owner can see or change a row (RLS). The Edge Function `send-push` reads every row
--  with the service role key, which bypasses RLS by design.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- upgrade an older table (endpoint was its primary key, no id / user_agent / updated_at)
alter table public.push_subscriptions add column if not exists id uuid default gen_random_uuid();
update public.push_subscriptions set id = gen_random_uuid() where id is null;
alter table public.push_subscriptions alter column id set not null;
create unique index if not exists push_subscriptions_id_key on public.push_subscriptions (id);
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();
-- endpoint stays unique in both shapes (primary key on old tables, unique constraint on new ones)
create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- keep updated_at honest
create or replace function private.touch_push_subscription()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch on public.push_subscriptions;
create trigger push_subscriptions_touch
  before update on public.push_subscriptions
  for each row execute function private.touch_push_subscription();

-- ---------------------------------------------------------------------
-- Row level security: your own subscriptions, nobody else's
-- ---------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists "push: own" on public.push_subscriptions;
drop policy if exists "push: select own" on public.push_subscriptions;
drop policy if exists "push: insert own" on public.push_subscriptions;
drop policy if exists "push: update own" on public.push_subscriptions;
drop policy if exists "push: delete own" on public.push_subscriptions;

create policy "push: select own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push: insert own" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "push: update own" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push: delete own" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------
-- save_push_subscription — what the app calls. A phone that switches accounts keeps the same endpoint:
-- a plain upsert would be refused by RLS (the old row belongs to the previous account), so this moves it.
-- ---------------------------------------------------------------------
drop function if exists public.save_push_subscription(text, text, text, text);
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'bad subscription';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
