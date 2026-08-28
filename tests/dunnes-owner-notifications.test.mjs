import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps unused vouchers private until the original owner confirms them", async () => {
  const [migration, helper, unusedApi, notificationsApi, popup, layout, proxy, fallback] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260828093000_private_owner_notifications.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/unused-review.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-unused/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OwnerVoucherNotification.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ViewedVoucherUsageConfirmation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table if not exists public\.user_notifications/);
  assert.match(migration, /recipient_profile_id uuid not null references public\.profiles/);
  assert.match(migration, /actor_profile_id uuid references public\.profiles/);
  assert.match(migration, /voucher_unused_confirmation/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /p\.auth_user_id = auth\.uid\(\)/);

  assert.match(helper, /set reserved_by = null/);
  assert.doesNotMatch(helper, /set status = 'available'/);
  assert.match(helper, /insert into user_notifications/);
  assert.match(helper, /recipient_profile_id/);
  assert.match(helper, /actor_profile_id/);

  assert.match(unusedApi, /authenticatedRequestProfile/);
  assert.match(unusedApi, /requestHasSameOrigin/);
  assert.match(unusedApi, /requestUnusedReviewByImage/);
  assert.match(unusedApi, /requestUnusedReviewByVoucherId/);

  assert.match(notificationsApi, /n\.recipient_profile_id = \$\{profile\.id\}::uuid/);
  assert.match(notificationsApi, /v\.owner_id = \$\{profile\.id\}::uuid/);
  assert.match(notificationsApi, /n\.status = 'unread'/);
  assert.match(notificationsApi, /and v\.reserved_by is null/);
  assert.match(notificationsApi, /resolution === "used"/);
  assert.match(notificationsApi, /else 'available'/);
  assert.match(notificationsApi, /set status = 'resolved'/);

  assert.match(popup, /fetch\("\/api\/notifications"/);
  assert.match(popup, /notificationId: pending\.id/);
  assert.match(popup, /resolve\("used"\)/);
  assert.match(popup, /resolve\("released"\)/);
  assert.match(layout, /<OwnerVoucherNotification \/>/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/notifications"\)/);

  assert.match(fallback, /used \? "\/api\/dunnes-vouchers" : "\/api\/dunnes-unused"/);
  assert.match(fallback, /\{ voucherId: pending\.voucher_id \}/);
});
