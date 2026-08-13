-- 1. Ringtone column
alter table public.app_settings
  add column if not exists ringtone_url text;

-- 2. Enable Realtime for messages (required for instant chat)
-- In Supabase Dashboard: Database → Replication → enable "messages"
-- Or run:
begin;
  drop publication if exists supabase_realtime;
  -- If publication already exists, just add the table:
  -- alter publication supabase_realtime add table messages;
commit;

-- Safer approach if publication exists:
alter publication supabase_realtime add table messages;
