create table if not exists public.user_error_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('screen', 'access', 'coupon', 'other')),
  message text not null check (char_length(message) between 10 and 1000),
  page_path text not null check (char_length(page_path) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists user_error_reports_status_created_idx
  on public.user_error_reports(status, created_at desc);

alter table public.user_error_reports enable row level security;
revoke all on table public.user_error_reports from anon, authenticated;
