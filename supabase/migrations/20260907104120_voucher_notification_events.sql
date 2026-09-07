create or replace function private.dispatch_couponshare_notifications()
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions, net, private
as $$
declare
  request_id bigint;
begin
  if (now() at time zone 'Europe/Dublin')::time >= time '09:00' then
    insert into public.app_notifications (profile_id, voucher_id, notification_type, dedupe_key)
    select
      v.owner_id,
      v.id,
      'voucher_expiring_today',
      'voucher_expiring_today:' || v.id::text || ':' || v.expires_on::text
    from public.dunnes_vouchers v
    where v.expires_on = (now() at time zone 'Europe/Dublin')::date
      and v.status in ('available', 'reserved')
      and v.review_status = 'approved'
    on conflict (dedupe_key) do nothing;
  end if;

  select net.http_post(
    url := c.endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-couponshare-notification-token', c.dispatch_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  into request_id
  from private.notification_dispatch_config c
  where c.singleton = true;

  return request_id;
end
$$;

revoke all on function private.dispatch_couponshare_notifications() from public, anon, authenticated;

create or replace function private.capture_dunnes_voucher_notification()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  event_type text;
  event_time timestamptz;
  inserted_id uuid;
begin
  if new.status = 'reserved'
     and new.reserved_by is not null
     and (old.status is distinct from 'reserved' or old.reserved_by is distinct from new.reserved_by) then
    event_type := 'voucher_reserved';
    event_time := coalesce(new.reserved_at, now());
  elsif old.status = 'reserved'
     and old.reserved_by is not null
     and new.status = 'available'
     and new.reserved_by is null
     and old.reserved_at is not null
     and old.reserved_at > now() - interval '30 minutes' then
    event_type := 'reservation_cancelled';
    event_time := now();
  elsif new.status = 'used' and old.status is distinct from 'used' then
    event_type := 'voucher_used';
    event_time := coalesce(new.used_at, now());
  else
    return new;
  end if;

  insert into public.app_notifications (profile_id, voucher_id, notification_type, dedupe_key)
  values (
    new.owner_id,
    new.id,
    event_type,
    event_type || ':' || new.id::text || ':' || extract(epoch from event_time)::numeric(20, 6)::text
  )
  on conflict (dedupe_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    perform private.dispatch_couponshare_notifications();
  end if;

  return new;
end
$$;

revoke all on function private.capture_dunnes_voucher_notification() from public, anon, authenticated;

drop trigger if exists dunnes_voucher_notification_events on public.dunnes_vouchers;
create trigger dunnes_voucher_notification_events
after update of status, reserved_by, reserved_at, used_at on public.dunnes_vouchers
for each row execute function private.capture_dunnes_voucher_notification();
