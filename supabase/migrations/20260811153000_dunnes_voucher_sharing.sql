create table if not exists public.dunnes_vouchers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  voucher_type text not null check (voucher_type in ('5off25', '10off40')),
  barcode text not null unique,
  image_data text not null,
  expires_on date not null,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'used', 'expired', 'rejected')),
  reserved_by uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dunnes_vouchers_status_expiry_idx
  on public.dunnes_vouchers(status, expires_on);
create index if not exists dunnes_vouchers_owner_idx
  on public.dunnes_vouchers(owner_id, created_at desc);
create index if not exists dunnes_vouchers_reserved_by_idx
  on public.dunnes_vouchers(reserved_by, reserved_at desc);

alter table public.dunnes_vouchers enable row level security;
