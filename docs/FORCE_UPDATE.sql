alter table public.app_settings
  add column if not exists min_app_version text default '1.0.0',
  add column if not exists apk_download_url text,
  add column if not exists force_update_message text,
  add column if not exists force_update_enabled boolean default false;
