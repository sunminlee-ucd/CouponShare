import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("notification system covers reservation, explicit cancellation, expiry-day and used events", async () => {
  const [schemaMigration, eventMigration, copy, push, service, api, subscriptionApi, dispatchApi, center, worker, layout, publicRuntime, proxy, ownerReview, ownerPopup] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260907103923_voucher_notification_system.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260907104120_voucher_notification_events.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/notifications/copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/notifications/web-push.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/notifications/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push-subscriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/dispatch/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/NotificationCenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/push-sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/owner-review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OwnerVoucherNotification.tsx", import.meta.url), "utf8"),
  ]);

  for (const type of ["voucher_reserved", "reservation_cancelled", "voucher_expiring_today", "voucher_used"]) {
    assert.match(schemaMigration, new RegExp(type));
  }
  assert.match(schemaMigration, /enable row level security/);
  assert.match(schemaMigration, /revoke all on table public\.app_notifications from anon, authenticated/);
  assert.match(schemaMigration, /cron\.schedule/);
  assert.match(schemaMigration, /\*\/15 \* \* \* \*/);

  assert.match(eventMigration, /new\.status = 'reserved'/);
  assert.match(eventMigration, /event_type := 'voucher_reserved'/);
  assert.match(eventMigration, /event_type := 'reservation_cancelled'/);
  assert.match(eventMigration, /old\.reserved_at > now\(\) - interval '30 minutes'/);
  assert.match(eventMigration, /event_type := 'voucher_used'/);
  assert.match(eventMigration, /v\.expires_on = \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
  assert.doesNotMatch(eventMigration, /expires_on\s*<=\s*\(now\(\).*\+ interval '1 day'/);
  assert.match(eventMigration, /time '09:00'/);

  assert.match(copy, /회원님의 Voucher가 예약되었습니다/);
  assert.match(copy, /예약이 취소되었습니다/);
  assert.match(copy, /오늘 만료됩니다/);
  assert.match(copy, /Voucher 사용이 완료되었습니다/);
  assert.match(copy, /잘못 눌렀을 가능성/);
  assert.match(copy, /확인해 보시는 것을 권장/);

  assert.match(push, /aes128gcm/);
  assert.match(push, /WebPush: info/);
  assert.match(push, /vapid t=/);
  assert.match(push, /prime256v1/);
  assert.match(push, /AUTH_SESSION_SECRET/);
  assert.match(service, /notification_push_deliveries/);
  assert.match(service, /result\.status === 404 \|\| result\.status === 410/);
  assert.match(service, /attempts/);

  assert.match(api, /mark_all_read/);
  assert.match(api, /order by n\.created_at desc/);
  assert.match(subscriptionApi, /getVapidPublicKey/);
  assert.match(subscriptionApi, /disabled_at = null/);
  assert.match(dispatchApi, /x-couponshare-notification-token/);
  assert.match(dispatchApi, /dispatchPendingNotifications/);

  assert.match(center, /기기 알림 켜기/);
  assert.match(center, /Notification\.requestPermission/);
  assert.match(center, /pushManager\.subscribe/);
  assert.match(center, /\/push-sw\.js/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.match(layout, /<PublicRuntime \/>/);
  assert.match(publicRuntime, /NotificationCenter/);
  assert.match(publicRuntime, /pathname\.startsWith\("\/admin"\)/);
  assert.match(proxy, /pathname === "\/api\/notifications\/dispatch"/);
  assert.match(proxy, /pathname === "\/push-sw\.js"/);

  assert.match(ownerReview, /v\.reserved_by is null/);
  assert.match(ownerPopup, /사용하지 않았다고 표시했습니다/);
  assert.match(ownerPopup, /\/api\/notifications\/owner-review/);
  assert.doesNotMatch(ownerPopup, /사용완료로 표시했습니다/);
});
