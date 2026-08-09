create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  device_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index if not exists group_members_profile_idx on group_members(profile_id);

create table if not exists lidl_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  qr_object_path text,
  is_shared boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  external_key text not null,
  product_id text not null,
  product_name text,
  label text not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  amount numeric(12, 4) not null,
  expires_text text not null,
  max_units integer not null default 1 check (max_units >= 1),
  keywords jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  source_captured_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, external_key)
);
create index if not exists coupons_owner_active_idx on coupons(owner_id, is_active);
create index if not exists coupons_product_idx on coupons(product_id);

create table if not exists coupon_use_events (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  used_by uuid not null references profiles(id) on delete cascade,
  used_at timestamptz not null default now(),
  reverted_at timestamptz
);

-- QR images live in a private Supabase Storage bucket. The database stores only object paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qr-codes',
  'qr-codes',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
