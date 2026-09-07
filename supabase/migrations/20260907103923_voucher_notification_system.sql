create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  voucher_id uuid references public.dunnes_vouchers(id) on delete cascade,
  notification_type text not null check (notification_type in ('voucher_reserved', 'reservation_cancelled', 'voucher_expiring_today', 'voucher_used')),
  dedupe_key text not null unique,
  read_at timestamptz,
  push_dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

create index app_notifications_profile_created_idx on public.app_notifications(profile_id, created_at desc);
create index app_notifications_pending_push_idx on public.app_notifications(created_at) where push_dispatched_at is null;

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  language text not null default 'ko' check (language in ('ko', 'en', 'fa', 'ja')),
  user_agent text,
  disabled_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index web_push_subscriptions_profile_active_idx on public.web_push_subscriptions(profile_id, updated_at desc) where disabled_at is null;

create table public.notification_push_deliveries (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'gone')),
  response_status integer,
  last_error text,
  attempted_at timestamptz,
  sent_at timestamptz,
  primary key (notification_id, subscription_id)
);

alter table public.app_notifications enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.notification_push_deliveries enable row level security;
revoke all on table public.app_notifications from anon, authenticated;
revoke all on table public.web_push_subscriptions from anon, authenticated;
revoke all on table public.notification_push_deliveries from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.notification_dispatch_config (
  singleton boolean primary key default true check (singleton),
  dispatch_token text not null,
  endpoint_url text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.notification_dispatch_config from public, anon, authenticated;

insert into private.notification_dispatch_config (singleton, dispatch_token, endpoint_url)
values (
  true,
  encode(extensions.gen_random_bytes(32), 'hex'),
  'https://couponshare-ireland-493377120974.europe-west1.run.app/api/notifications/dispatch'
)
on conflict (singleton) do update
set endpoint_url = excluded.endpoint_url,
    updated_at = now();

create or replace function private.dispatch_couponshare_notifications()
returns bigint
language sql
security invoker
set search_path = pg_catalog, public, extensions, net, private
as $$
  select net.http_post(
    url := c.endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-couponshare-notification-token', c.dispatch_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  from private.notification_dispatch_config c
  where c.singleton = true
$$;

revoke all on function private.dispatch_couponshare_notifications() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'couponshare-notification-dispatch'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'couponshare-notification-dispatch',
  '*/15 * * * *',
  'select private.dispatch_couponshare_notifications()'
);
