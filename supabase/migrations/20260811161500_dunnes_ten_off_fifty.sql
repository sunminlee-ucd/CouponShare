alter table public.dunnes_vouchers
  drop constraint if exists dunnes_vouchers_voucher_type_check;

alter table public.dunnes_vouchers
  add constraint dunnes_vouchers_voucher_type_check
  check (voucher_type in ('5off25', '10off40', '10off50'));
