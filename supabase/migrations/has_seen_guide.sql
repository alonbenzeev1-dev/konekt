-- =====================================================================
--  KONEKT — remember on the server that a user has seen the walkthrough.
--  localStorage is not shared between Safari and the installed Home Screen
--  app on iOS, so the flag has to live on the profile.
--  Paste into: Supabase Dashboard → SQL Editor → Run. Safe to re-run.
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_seen_guide boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
