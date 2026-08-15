create table if not exists public.dunnes_voucher_activity (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.dunnes_vouchers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('viewed')),
  occurred_at timestamptz not null default now()
);

create index if not exists dunnes_voucher_activity_daily_idx
  on public.dunnes_voucher_activity(event_type, occurred_at desc, profile_id);

alter table public.dunnes_voucher_activity enable row level security;
