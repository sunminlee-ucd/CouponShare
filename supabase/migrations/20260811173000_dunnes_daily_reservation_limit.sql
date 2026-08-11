create table if not exists public.dunnes_daily_reservations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  reservation_count smallint not null default 0 check (reservation_count between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (profile_id, usage_date)
);

alter table public.dunnes_daily_reservations enable row level security;
