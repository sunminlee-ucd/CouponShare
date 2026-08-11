alter table public.dunnes_vouchers
  add column if not exists membership_required boolean not null default false;

alter table public.dunnes_vouchers
  add column if not exists membership_image_data text;
