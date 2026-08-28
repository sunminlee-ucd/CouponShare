create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  voucher_id uuid not null references public.dunnes_vouchers(id) on delete cascade,
  type text not null check (type in ('voucher_unused_confirmation')),
  status text not null default 'unread' check (status in ('unread', 'resolved')),
  resolution text check (resolution in ('released', 'used')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists user_notifications_recipient_status_idx
  on public.user_notifications(recipient_profile_id, status, created_at desc);

create index if not exists user_notifications_voucher_idx
  on public.user_notifications(voucher_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_recipient_select on public.user_notifications;
create policy user_notifications_recipient_select
  on public.user_notifications
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = recipient_profile_id
        and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists user_notifications_recipient_update on public.user_notifications;
create policy user_notifications_recipient_update
  on public.user_notifications
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = recipient_profile_id
        and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = recipient_profile_id
        and p.auth_user_id = auth.uid()
    )
  );
