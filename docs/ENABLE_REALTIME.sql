-- ============================================
-- GEEZ — Enable Realtime (run once in SQL Editor)
-- ============================================

-- 1) Extra columns (safe if already exist)
alter table public.app_settings
  add column if not exists ringtone_url text,
  add column if not exists app_icon_url text,
  add column if not exists splash_url text;

alter table public.profiles
  add column if not exists pin_hash text,
  add column if not exists avatar_url text;

-- 2) Add tables to the supabase_realtime publication
--    (ignore errors if a table is already a member)

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.goals;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.withdrawals;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;

-- 3) Required for realtime payloads (REPLICA IDENTITY)
alter table public.messages replica identity full;
alter table public.transactions replica identity full;
alter table public.goals replica identity full;
alter table public.withdrawals replica identity full;
alter table public.notifications replica identity full;

-- 4) Verify (optional — should list the tables above)
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
