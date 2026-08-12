-- ============================================
-- GEEZ — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  avatar_url text,
  phone text,
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- TRANSACTIONS (Deposits)
-- ============================================
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  tx_ref text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'MWK',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'cancelled')),
  depositor_id uuid references public.profiles(id) on delete set null,
  depositor_name text not null,
  payment_method text check (payment_method in ('airtel_money', 'tnm_mpamba', 'bank', 'card', 'other')),
  paychangu_data jsonb,
  receipt_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_status_idx on public.transactions(status);
create index transactions_depositor_id_idx on public.transactions(depositor_id);
create index transactions_created_at_idx on public.transactions(created_at desc);

-- ============================================
-- WITHDRAWALS
-- ============================================
create table public.withdrawals (
  id uuid primary key default uuid_generate_v4(),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'MWK',
  destination_type text not null check (destination_type in ('airtel_money', 'tnm_mpamba')),
  phone_number text not null,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'processing', 'success', 'failed', 'cancelled')),
  initiated_by uuid not null references public.profiles(id),
  confirmation_code text,
  code_expires_at timestamptz,
  paychangu_ref text,
  paychangu_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index withdrawals_status_idx on public.withdrawals(status);
create index withdrawals_initiated_by_idx on public.withdrawals(initiated_by);

-- ============================================
-- GOALS
-- ============================================
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0,
  deadline date,
  emoji text default '🎯',
  created_by uuid not null references public.profiles(id),
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null check (type in ('deposit', 'withdrawal', 'goal', 'system', 'security')),
  read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_read_idx on public.notifications(user_id, read);

-- ============================================
-- APP SETTINGS (single row)
-- ============================================
create table public.app_settings (
  id text primary key default 'main',
  logo_url text,
  favicon_url text,
  og_image_url text,
  app_name text not null default 'GEEZ',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, app_name) values ('main', 'GEEZ');

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

create trigger withdrawals_updated_at
  before update on public.withdrawals
  for each row execute function public.handle_updated_at();

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.handle_updated_at();

-- ============================================
-- AUTO CREATE PROFILE ON SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.withdrawals enable row level security;
alter table public.goals enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;

-- Profiles: users can read all (needed for names), update only own
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Transactions: all authenticated can read, insert via service role / server
create policy "Transactions are viewable by authenticated users"
  on public.transactions for select
  to authenticated
  using (true);

create policy "Service role can insert transactions"
  on public.transactions for insert
  to authenticated
  with check (true); -- further restricted in app logic

-- Withdrawals
create policy "Withdrawals are viewable by authenticated users"
  on public.withdrawals for select
  to authenticated
  using (true);

create policy "Users can create withdrawals"
  on public.withdrawals for insert
  to authenticated
  with check (auth.uid() = initiated_by);

-- Goals
create policy "Goals are viewable by authenticated users"
  on public.goals for select
  to authenticated
  using (true);

create policy "Users can manage goals"
  on public.goals for all
  to authenticated
  using (true)
  with check (true);

-- Notifications: only own
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- App settings: readable by all authenticated, writable by admin (enforced in app)
create policy "Settings are viewable by authenticated users"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "Settings updatable by authenticated"
  on public.app_settings for update
  to authenticated
  using (true);

-- Extra branding columns (safe to run even if already present)
alter table public.app_settings
  add column if not exists app_icon_url text,
  add column if not exists splash_url text;

-- ============================================
-- MESSAGES (Chat)
-- ============================================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages(created_at);

alter table public.messages enable row level security;

create policy "Authenticated users can read messages"
  on public.messages for select
  to authenticated
  using (true);

create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow admins to delete for reset (broad delete for authenticated — tighten later if needed)
create policy "Authenticated can delete transactions for reset"
  on public.transactions for delete
  to authenticated
  using (true);

create policy "Authenticated can delete withdrawals for reset"
  on public.withdrawals for delete
  to authenticated
  using (true);

create policy "Authenticated can delete goals"
  on public.goals for delete
  to authenticated
  using (true);

create policy "Authenticated can delete notifications"
  on public.notifications for delete
  to authenticated
  using (true);

create policy "Authenticated can delete messages"
  on public.messages for delete
  to authenticated
  using (true);
