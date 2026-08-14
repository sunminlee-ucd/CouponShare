create table if not exists public.lidl_card_reports (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.lidl_cards(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('invalid_qr', 'unrelated_image', 'coupon_mismatch')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (card_id, reporter_id, reason)
);

create index if not exists lidl_card_reports_open_idx
  on public.lidl_card_reports(created_at asc)
  where status = 'open';

alter table public.lidl_card_reports enable row level security;
