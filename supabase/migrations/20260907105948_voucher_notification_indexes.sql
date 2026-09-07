create index if not exists app_notifications_voucher_idx
  on public.app_notifications (voucher_id);

create index if not exists notification_push_deliveries_subscription_idx
  on public.notification_push_deliveries (subscription_id);
