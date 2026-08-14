create table if not exists public.dunnes_voucher_reports (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.dunnes_vouchers(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('invalid_voucher', 'membership_not_scanned')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (voucher_id, reporter_id, reason)
);

create index if not exists dunnes_voucher_reports_open_idx
  on public.dunnes_voucher_reports(created_at asc)
  where status = 'open';

alter table public.dunnes_voucher_reports enable row level security;
