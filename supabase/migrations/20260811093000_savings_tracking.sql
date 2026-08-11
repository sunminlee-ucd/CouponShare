alter table public.coupon_use_events
  add column if not exists saved_amount numeric(12, 4) not null default 0;

create index if not exists coupon_use_events_used_by_used_at_idx
  on public.coupon_use_events (used_by, used_at);
