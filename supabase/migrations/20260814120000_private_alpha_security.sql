create table if not exists public.api_rate_limits (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, action, window_start)
);

alter table public.api_rate_limits enable row level security;

alter table public.dunnes_vouchers
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected'));

alter table public.dunnes_vouchers alter column review_status set default 'pending';

create index if not exists dunnes_vouchers_pending_review_idx
  on public.dunnes_vouchers(updated_at desc)
  where review_status = 'pending';
