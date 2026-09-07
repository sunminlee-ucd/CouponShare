import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows used voucher activity while keeping analytics isolated from existing profile data", async () => {
  const [layout, publicRuntime, tracker, activityApi, adminActivity, adminActivityUi, usedApi, adminUsedApi, adminUsedUi, stateApi, privacy, migration] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AppActivityTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/activity-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/user-activity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminUserActivityPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-used-today/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dunnes-usage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDunnesUsageSummary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260906221500_app_user_sessions.sql", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<PublicRuntime \/>/);
  assert.match(publicRuntime, /AppActivityTracker/);
  assert.match(publicRuntime, /TodayUsedVouchersPanel/);
  assert.match(publicRuntime, /pathname\.startsWith\("\/admin"\)/);
  assert.match(tracker, /HEARTBEAT_MS = 45_000/);
  assert.match(tracker, /"start" \| "heartbeat" \| "page_view" \| "end"/);
  assert.match(tracker, /pagehide/);
  assert.match(tracker, /beforeunload/);

  assert.match(activityApi, /authenticatedRequestProfile\(request\)/);
  assert.match(activityApi, /tracked: false/);
  assert.match(activityApi, /insert into app_user_sessions/);
  assert.match(activityApi, /page_views = page_views \+ 1/);
  assert.match(activityApi, /ended_at = now\(\)/);
  assert.match(activityApi, /error\.code === "42P01"/);
  assert.match(activityApi, /reason: "activity_schema_pending"/);
  assert.doesNotMatch(activityApi, /insert into profiles/);
  assert.doesNotMatch(activityApi, /update profiles/);
  assert.doesNotMatch(activityApi, /delete from profiles/);

  assert.match(adminActivity, /online_now/);
  assert.match(adminActivity, /sessions_today/);
  assert.match(adminActivity, /total_sessions/);
  assert.match(adminActivity, /page_views_today/);
  assert.match(adminActivity, /available: false/);
  assert.match(adminActivity, /error\.code === "42P01"/);
  assert.match(adminActivityUi, /사용자 접속 현황/);
  assert.match(adminActivityUi, /최근 입장·이탈 기록/);
  assert.match(adminActivityUi, /오늘 접속/);
  assert.match(adminActivityUi, /누적 접속/);

  assert.match(usedApi, /usedToday/);
  assert.match(usedApi, /status = 'used'/);
  assert.match(usedApi, /Europe\/Dublin/);
  assert.doesNotMatch(usedApi, /image_data/);
  assert.match(adminUsedApi, /total_used/);
  assert.match(adminUsedApi, /used_today/);
  assert.match(adminUsedApi, /used_last_7_days/);
  assert.match(adminUsedUi, /사용완료 현황/);
  assert.match(adminUsedUi, /누적 사용완료/);

  assert.match(stateApi, /v\.status = 'used'/);
  assert.match(stateApi, /v\.used_at at time zone 'Europe\/Dublin'/);
  assert.match(stateApi, /else false\s+end as reserved_by_me/);
  assert.match(privacy, /접속 시작 시각/);
  assert.match(privacy, /페이지 이동 횟수/);
  assert.match(privacy, /둘러보기 모드/);

  assert.match(migration, /create table if not exists public\.app_user_sessions/);
  assert.match(migration, /create index if not exists app_user_sessions_started_idx/);
  assert.match(migration, /alter table public\.app_user_sessions enable row level security/);
  assert.match(migration, /revoke all on table public\.app_user_sessions from anon, authenticated/);
  assert.doesNotMatch(migration, /alter table public\.(?!app_user_sessions)/i);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from|update public\./i);
});
