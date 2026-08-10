alter table profiles
  add column if not exists is_blocked boolean not null default false,
  add column if not exists risk_score integer not null default 0 check (risk_score >= 0);

alter table lidl_cards
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column if not exists review_note text;

create table if not exists qr_daily_usage (
  profile_id uuid not null references profiles(id) on delete cascade,
  usage_date date not null,
  view_count smallint not null default 0 check (view_count between 0 and 3),
  blocked_attempts integer not null default 0 check (blocked_attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, usage_date)
);

alter table qr_daily_usage enable row level security;

create index if not exists profiles_blocked_idx
  on profiles(updated_at desc)
  where is_blocked = true;

create index if not exists lidl_cards_pending_review_idx
  on lidl_cards(updated_at desc)
  where review_status = 'pending';

create index if not exists qr_daily_usage_blocked_idx
  on qr_daily_usage(usage_date desc, blocked_attempts desc)
  where blocked_attempts > 0;
