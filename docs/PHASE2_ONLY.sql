-- Run this if phase1 already applied (avoids duplicate policy errors)

alter table public.goals
  add column if not exists goal_type text default 'normal',
  add column if not exists end_date date,
  add column if not exists owner_id uuid references public.profiles(id),
  add column if not exists dual_pair_id uuid,
  add column if not exists early_exit_fee_percent numeric(5,2) default 6,
  add column if not exists maturity_fee_percent numeric(5,2) default 3;

update public.goals set owner_id = created_by where owner_id is null;

alter table public.withdrawals
  add column if not exists fee_percent numeric(5,2) default 3,
  add column if not exists fee_amount numeric(14,2) default 0,
  add column if not exists net_amount numeric(14,2),
  add column if not exists source_type text default 'general',
  add column if not exists goal_id uuid,
  add column if not exists confirmation_email text,
  add column if not exists is_early_exit boolean default false;

create table if not exists public.fee_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  withdrawal_id uuid references public.withdrawals(id),
  goal_id uuid references public.goals(id),
  fee_type text not null,
  amount numeric(14,2) not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.fee_ledger enable row level security;

drop policy if exists "Admins read fee ledger" on public.fee_ledger;
create policy "Admins read fee ledger"
  on public.fee_ledger for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin','admin','finance')
    )
  );

alter table public.app_settings
  add column if not exists withdraw_fee_percent numeric(5,2) default 3,
  add column if not exists early_exit_fee_percent numeric(5,2) default 6,
  add column if not exists maturity_fee_percent numeric(5,2) default 3;

-- Transactions may need goal_id for deposit → goal
alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id);

-- General balance already on profiles from phase1
